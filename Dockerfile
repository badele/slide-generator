FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ARG USERNAME=ubuntu

RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    fontconfig \
    imagemagick \
    git \
    bash \
    xz-utils \
    sudo \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash ${USERNAME} && \
    echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

USER ${USERNAME}
ENV USER=${USERNAME}
WORKDIR /home/${USERNAME}

RUN curl -L https://nixos.org/nix/install | sh

RUN mkdir -p ~/.config/nix && \
    echo "experimental-features = nix-command flakes" > ~/.config/nix/nix.conf

RUN echo "if [ -e /home/${USERNAME}/.nix-profile/etc/profile.d/nix.sh ]; then . /home/${USERNAME}/.nix-profile/etc/profile.d/nix.sh; fi" >> ~/.bashrc

COPY --chown=${USERNAME}:${USERNAME} . /home/${USERNAME}/slide-generator

WORKDIR /home/${USERNAME}/slide-generator

CMD ["/bin/bash", "-c", "source ~/.nix-profile/etc/profile.d/nix.sh && nix develop --command just test"]
