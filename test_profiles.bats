#!/usr/bin/env bats

#  vim: set ft=bash :

setup() {
    export ROOT_DIR="$(pwd)"

    rm -f output.png test_output_*.png
}

teardown() {
    # Clean up after tests
    rm -f output.png test_output_*.png
}

get_profiles() {
    find profiles -maxdepth 1 -type d -name "*" ! -name "profiles" | xargs -n1 basename | sort
}

run_profile_configured_tests() {
    local profile="$1"
    local config_file="profiles/$profile/test_config.yaml"
    
    if [[ ! -f "$config_file" ]]; then
        echo "   ⚠️  No yaml test configuration file, use default configuration"
        return 0
    fi
    
    echo "   📄 Configuration found: $config_file"
    
    local test_count=$(yq '.tests | length' "$config_file")
    echo "   📊 Number of configured tests: $test_count"
    
    for ((i=0; i<test_count; i++)); do
        local test_name=$(yq ".tests[$i].name" "$config_file")
        local test_desc=$(yq ".tests[$i].description" "$config_file")
        
        echo "      🧪 Test $((i+1))/$test_count: $test_name"
        echo "         📝 $test_desc"
        
        # Build command arguments
        local cmd_args=""
        local arg_count=$(yq ".tests[$i].command_args | length" "$config_file")
        for ((j=0; j<arg_count; j++)); do
            local arg=$(yq -r ".tests[$i].command_args[$j]" "$config_file")
            cmd_args="$cmd_args $arg"
        done
        
        echo "         💻 Arguments: $cmd_args"

        # Execute the test
        run eval ./generate_slide.sh --profile "$profile" $cmd_args
       
        # [ "$status" -eq 0 ]
        if [[ ! -f "output.png" ]]; then 
        echo "         ❌ Error on running ./generate_slide.sh script"
        echo "OUTPUT: $output" 

        exit 1
        fi

        mv output.png "test_output_${profile}_$((i+1)).png"
        ORIGINAL=$(magick "profiles/${profile}/sample$((i+1)).png" -colorspace Gray -format "%#" info:)
        GENERATED=$(magick "test_output_${profile}_$((i+1)).png" -colorspace Gray -format "%#" info:)

        if [[ "$ORIGINAL" == "$GENERATED" ]]; then
            echo "         ✅ generated slide same the sample slide"
        else
            echo "         ❌ genereted slide fingerprint different from the sample slide"
            exit 1
        fi
    done
}

@test "All profiles have a configuration file" {
    local profile
    for profile in $(get_profiles); do
        echo "Checking profile: $profile"
        [ -f "profiles/$profile/config" ]
    done
}

@test "Configured tests per profile" {
    local profile
    for profile in $(get_profiles); do
        echo "🔍 Tests for profile: $profile"
        run_profile_configured_tests "$profile"
    done
}

@test "Test profile file configuration" {
    local profile
    for profile in $(get_profiles); do
        local config_file="profiles/$profile/test_config.yaml"
        if [[ ! -f "$config_file" ]]; then
            echo "Test 'config' file configuration exists for the profile: $profile"
            run ./generate_slide.sh --profile "$profile"
            [ "$status" -eq 0 ]
            [ -f "output.png" ]
            rm -f "output.png"
        fi
    done
}
