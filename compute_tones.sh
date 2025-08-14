COLOR="gold"

step=75

echo "###"
echo "### text color ###"
echo "###"

index=$step
pastel color $COLOR
while [ $index -lt 360 ]; do
  pastel color $COLOR | pastel rotate $index
  index=$((index + $step))
done

echo "###"
echo "### background color ###"
echo "###"

index=$step
pastel color $COLOR
while [ $index -lt 360 ]; do
  pastel color $COLOR | pastel rotate $index | pastel darken 0.25 | pastel desaturate 0.25
  index=$((index + $step))
done
