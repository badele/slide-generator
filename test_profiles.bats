#!/usr/bin/env bats

#  vim: set ft=bash :

setup() {
    export ROOT_DIR="$(pwd)"
    
    # Nettoyer les fichiers de test précédents
    rm -f output.png test_output_*.png
    
    # Vérifier que yq est disponible pour parser YAML
    if ! command -v yq &> /dev/null; then
        echo "⚠️  yq non trouvé, utilisation du mode de fallback"
        export FALLBACK_MODE=1
    else
        export FALLBACK_MODE=0
    fi
}

teardown() {
    # Nettoyer après les tests
    rm -f output.png test_output_*.png
}

# Fonction helper pour obtenir la liste des profils
get_profiles() {
    find profiles -maxdepth 1 -type d -name "*" ! -name "profiles" | xargs -n1 basename | sort
}

# Fonction pour parser YAML manuellement (fallback)
parse_yaml_fallback() {
    local config_file="$1"
    local test_index="$2"
    
    # Extraction basique avec grep et sed
    local test_section=$(grep -A 20 "^  - name:" "$config_file" | head -n 20)
    local name=$(echo "$test_section" | grep "name:" | sed 's/.*name: *"\(.*\)".*/\1/')
    local args=$(echo "$test_section" | grep -A 10 "command_args:" | grep "^      -" | sed 's/.*- *"\(.*\)".*/\1/')
    
    echo "$name|||$args"
}

# Fonction pour exécuter les tests configurés d'un profil
run_profile_configured_tests() {
    local profile="$1"
    local config_file="profiles/$profile/test_config.yaml"
    
    if [[ ! -f "$config_file" ]]; then
        echo "   ⚠️  Pas de configuration spécifique, utilisation des tests par défaut"
        return 0
    fi
    
    echo "   📄 Configuration trouvée: $config_file"
    
    if [[ "$FALLBACK_MODE" == "1" ]]; then
        # Mode fallback sans yq
        echo "   🔄 Mode fallback activé"
        local test_info=$(parse_yaml_fallback "$config_file" 0)
        local test_name=$(echo "$test_info" | cut -d'|||' -f1)
        local test_args=$(echo "$test_info" | cut -d'|||' -f2)
        
        echo "      🧪 Test: $test_name"
        run ./generate_slide.sh --profile "$profile" $test_args
        [ "$status" -eq 0 ]
        [ -f "output.png" ]
        rm -f "output.png"
    else
        # Mode complet avec yq
        local test_count=$(yq eval '.tests | length' "$config_file")
        echo "   📊 Nombre de tests configurés: $test_count"
        
        for ((i=0; i<test_count; i++)); do
            local test_name=$(yq eval ".tests[$i].name" "$config_file")
            local test_desc=$(yq eval ".tests[$i].description" "$config_file")
            local expected_success=$(yq eval ".tests[$i].expect_success // true" "$config_file")
            
            echo "      🧪 Test $((i+1))/$test_count: $test_name"
            echo "         📝 $test_desc"
            
            # Construire les arguments de commande
            local cmd_args=""
            local arg_count=$(yq eval ".tests[$i].command_args | length" "$config_file")
            for ((j=0; j<arg_count; j++)); do
                local arg=$(yq eval ".tests[$i].command_args[$j]" "$config_file")
                cmd_args="$cmd_args $arg"
            done
            
            echo "         💻 Arguments: $cmd_args"
            
            # Exécuter le test
            run ./generate_slide.sh --profile "$profile" $cmd_args
            
            if [[ "$expected_success" == "true" ]]; then
                [ "$status" -eq 0 ]
                [ -f "output.png" ]
            fi
            
            # Vérifier les fichiers attendus
            local expected_files_count=$(yq eval ".tests[$i].expected_files | length" "$config_file")
            for ((k=0; k<expected_files_count; k++)); do
                local expected_file=$(yq eval ".tests[$i].expected_files[$k]" "$config_file")
                [ -f "$expected_file" ]
            done
            
            rm -f output.png
            echo "         ✅ Test réussi"
        done
    fi
}

@test "Tous les profils ont un fichier de configuration" {
    local profile
    for profile in $(get_profiles); do
        echo "Vérification du profil: $profile"
        [ -f "profiles/$profile/config" ]
    done
}

@test "Tests configurés par profil" {
    local profile
    for profile in $(get_profiles); do
        echo "🔍 Tests pour le profil: $profile"
        run_profile_configured_tests "$profile"
    done
}

@test "Tests de fallback pour profils sans configuration" {
    local profile
    for profile in $(get_profiles); do
        local config_file="profiles/$profile/test_config.yaml"
        if [[ ! -f "$config_file" ]]; then
            echo "🔄 Test fallback pour le profil: $profile"
            run ./generate_slide.sh --profile "$profile" --set TEXT1="Test Fallback"
            [ "$status" -eq 0 ]
            [ -f "output.png" ]
            rm -f "output.png"
        fi
    done
}
