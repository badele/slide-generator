#!/usr/bin/env bats

#  vim: set ft=bash :

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

    for ((i = 0; i < test_count; i++)); do
        local test_name=$(yq ".tests[$i].name" "$config_file")
        local test_desc=$(yq ".tests[$i].description" "$config_file")

        echo "      🧪 Test $((i + 1))/$test_count: $test_name"
        echo "         📝 $test_desc"

        # Build command arguments
        local cmd_args=""
        local arg_count=$(yq ".tests[$i].command_args | length" "$config_file")
        for ((j = 0; j < arg_count; j++)); do
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

        FILE_SRC="tests/${profile}-sample$((i + 1))-test-orig.png"
        FILE_DST="tests/${profile}-sample$((i + 1))-test-output.png"
        FILE_DIFF="tests/${profile}-sample$((i + 1))-diff.png"

        cp "profiles/${profile}/sample$((i + 1)).png" "$FILE_SRC"
        mv output.png "$FILE_DST"

        ORIGINAL=$(magick "$FILE_SRC" -colorspace Gray -format "%#" info:)
        GENERATED=$(magick "$FILE_DST" -colorspace Gray -format "%#" info:)

        if [[ "$ORIGINAL" == "$GENERATED" ]]; then
            echo "         ✅ generated slide same the sample slide"
        else
            echo "         ❌ genereted slide fingerprint different from the sample slide"
            just compare "$FILE_SRC" "$FILE_DST" "$FILE_DIFF"
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
            rm -f "output.png"
            run ./generate_slide.sh --profile "$profile"
            [ "$status" -eq 0 ]
        fi
    done
}
