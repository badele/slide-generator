#!/usr/bin/env just -f

set export

# This help
@help:
    just -l -u

[private]
download-nextart-font:
    #!/usr/bin/env bash
    FONTPATH="$HOME/.local/share/fonts"

    if [ ! -d "$HOME/.local/share/fonts" ]; then
        echo "Downloading NEXT ART font..."

        mkdir -p $HOME/.local/share/fonts
        curl -o nextart.zip "https://dl.dafont.com/dl/?f=next_art"
        unzip nextart.zip -d $HOME/.local/share/fonts/
        fc-cache -fv
    fi

[private]
check-requirements:
    #!/usr/bin/env bash
    for cmd in curl bats unzip magick yq; do
        if ! command -v $cmd >/dev/null 2>&1; then
            echo "$cmd is not installed. Please install it to run tests."
            exit 1
        fi
    done

# Run all profiles tests
@test: check-requirements download-nextart-font
    ./run_tests.sh

# Compare image (when test fails)
@compare SRC DST:
    compare -metric RMSE "$SRC" "$DST" difference.png | sed 's/^\(.*\)$/\1/' || true

# Compute color tones
@tones:
    ./compute_tones.sh

