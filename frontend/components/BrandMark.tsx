import { Image, StyleSheet, View } from 'react-native';

interface BrandMarkProps {
  size?: number;
  imageScale?: number;
}

export default function BrandMark({ size = 40, imageScale = 0.68 }: BrandMarkProps) {
  const imageSize = Math.round(size * imageScale);

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Image
        source={require('../assets/images/greyadz-logo-v3.png')}
        style={[
          styles.image,
          {
            width: imageSize,
            height: imageSize,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  image: {
  },
});
