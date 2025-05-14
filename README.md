# slide-generator

This project Generate clean, impactful slides for your social media posts in
seconds.

## Samples

### blue_background

```bash
set -a ; source profiles/devops_blue_background ; set +a ; 
export TEXT3="SLIDE GENERATOR"
export TEXT4="Generate clean, impactful slides"
export TEXT5="for your social media posts in seconds"
./generate_slide.sh
```

![blue_background](./docs/blue_background.png)

### img_background

```bash
set -a ; source profiles/devops_blue_background ; set +a ; 
export BACKGROUND_IMG="/home/badele/Pictures/2025-04-26_19-07.png"
export TEXT3="SLIDE GENERATOR"
export TEXT4="Generate clean, impactful slides"
export TEXT5="for your social media posts in seconds"
./generate_slide.sh
```

![img_background](./docs/img_background.png)

### img_with_text_background

```bash
set -a ; source profiles/devops_img_with_text_background ; set +a ; 
export BACKGROUND_IMG="/home/badele/Pictures/2025-04-26_19-07.png"
export TEXT3="SLIDE GENERATOR"
export TEXT4="Generate clean, impactful slides"
export TEXT5="for your social media posts in seconds"
./generate_slide.sh
```

![img_with_text_background](./docs/img_with_text_background.png)
