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
@compare SRC DST OUTPUT="difference.png":
    compare -metric RMSE "{{ SRC }}" "{{ DST }}" {{ OUTPUT }} | sed 's/^\(.*\)$/\1/' || true

# Compute color tones
@tones:
    cd resources &&tones-generator.sh gold 12 3

# Generate mosaic of all profiles
[group('ci')]
@update-mosaic:
    montage profiles/*/*.png -geometry x150+2+2 -background black -font NEXTART-Light +label mosaique.png

# Update ALL_SAMPLES.md with all sample images
[group('ci')]
update-samples:
    #!/usr/bin/env bash
    echo "# All Profile Samples" > ALL_SAMPLES.md
    echo "" >> ALL_SAMPLES.md
    echo "This file contains all sample images from all profiles." >> ALL_SAMPLES.md
    echo "" >> ALL_SAMPLES.md
    
    for profile_dir in profiles/*/; do
        profile_name=$(basename "$profile_dir")
        samples=$(find "$profile_dir" -name "sample*.png" | sort)
        
        if [ -n "$samples" ]; then
            echo "## $profile_name" >> ALL_SAMPLES.md
            echo "" >> ALL_SAMPLES.md
            
            for sample in $samples; do
                sample_name=$(basename "$sample")
                echo "![${profile_name} - ${sample_name}]($sample)" >> ALL_SAMPLES.md
                echo "" >> ALL_SAMPLES.md
            done
        fi
    done

# Update projects
[group('ci')]
@update-project:
    just update-mosaic
    just update-samples

# Run all profiles tests
@test: check-requirements download-nextart-font
    mkdir -p tests
    rm -f tests/*
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
    mkdir -p tests && chmod 777 tests
    docker run --rm -v slide-nix-store:/nix/store -v ./tests:/home/ubuntu/slide-generator/tests slide-generator-tests:latest
