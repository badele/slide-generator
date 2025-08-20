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

        # Install NetArt font
        curl -o /tmp/nextart.zip "https://dl.dafont.com/dl/?f=next_art"
        unzip /tmp/nextart.zip -d $HOME/.local/share/fonts/

        # Install Segoe UI This font
        curl -o /tmp/segoe-ui-this.zip "https://font.download/dl/font/segoe-ui-this.zip"
        unzip /tmp/segoe-ui-this.zip -d $HOME/.local/share/fonts/

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

# Compare image (when test fails)
@compare SRC DST:
    compare -metric RMSE "$SRC" "$DST" difference.png | sed 's/^\(.*\)$/\1/' || true

# Compute color tones
@tones:
    ./compute_tones.sh

# Run all profiles tests
@test: check-requirements download-nextart-font
    ./run_tests.sh

# build docker image
[group('docker')]
@docker-build:
    #!/usr/bin/env bash

    cp .gitignore .dockerignore
    cat >> .dockerignore << 'EOF'
    Dockerfile*
    .dockerignore
    .git/
    .gitignore
    README.md
    EOF

    docker build -t slide-generator-tests:latest .

# Test side-generator in docker
[group('docker')]
@docker-test: docker-build
    docker run --rm slide-generator-tests:latest
