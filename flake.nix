{
  description = "Slide generator";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.glsl-shader-effects.url = "github:badele/awesome-scripts?dir=images/glsl-shader-effects";

  outputs =
    {
      self,
      nixpkgs,
      glsl-shader-effects,
    }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };

      slide-generator = pkgs.stdenv.mkDerivation {
        pname = "slide-generator";
        version = "1.0.0";

        src = ./.;

        nativeBuildInputs = with pkgs; [ makeWrapper ];

        buildInputs = with pkgs; [
          bash
          bats
          just
          pastel
          yq
          glsl-shader-effects.packages.${system}.default
        ];

        installPhase = ''
          mkdir -p $out/profiles

          cp generate_slide.sh $out
          cp -r profiles $out

          chmod +x $out/generate_slide.sh
        '';

        meta = {
          description = "Slide generator";
          maintainers = [ ];
        };
      };
    in
    {
      packages.${system}.default = slide-generator;

      # nix run
      apps.${system}.default = {
        type = "app";
        program = "${slide-generator}/generate_slide.sh";
      };

      # nix develop
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          bats
          imagemagick
          just
          pastel
          yq
          glsl-shader-effects.packages.${system}.default
        ];
      };
    };
}
