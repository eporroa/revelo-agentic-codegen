import React from 'react';
import { Box, useTheme, useMediaQuery, SxProps, Theme } from '@mui/material';
import { Car } from '../types/car';

export interface ResponsiveImageSources {
  mobile?: string;
  tablet?: string;
  desktop?: string;
}

export interface ResponsiveCarImageProps {
  car?: Car;
  images?: ResponsiveImageSources;
  mobileSrc?: string;
  tabletSrc?: string;
  desktopSrc?: string;
  mobile?: string;
  tablet?: string;
  desktop?: string;
  src?: string;
  defaultSrc?: string;
  fallbackSrc?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  aspectRatio?: number | string;
  objectFit?: React.CSSProperties['objectFit'];
  loading?: 'lazy' | 'eager';
  className?: string;
  sx?: SxProps<Theme>;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

export default function ResponsiveCarImage({
  car,
  images,
  mobileSrc,
  tabletSrc,
  desktopSrc,
  mobile: mobileProp,
  tablet: tabletProp,
  desktop: desktopProp,
  src,
  defaultSrc,
  fallbackSrc,
  alt,
  width = '100%',
  height = 'auto',
  aspectRatio,
  objectFit = 'cover',
  loading = 'lazy',
  className,
  sx,
  style,
  onClick,
}: ResponsiveCarImageProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const desktopImage = desktopSrc || desktopProp || images?.desktop;
  const tabletImage = tabletSrc || tabletProp || images?.tablet;
  const mobileImage = mobileSrc || mobileProp || images?.mobile;
  const fallback = src || defaultSrc || fallbackSrc || desktopImage || tabletImage || mobileImage || '';

  let activeSrc = fallback;
  if (isDesktop && desktopImage) {
    activeSrc = desktopImage;
  } else if (isTablet && tabletImage) {
    activeSrc = tabletImage;
  } else if (isMobile && mobileImage) {
    activeSrc = mobileImage;
  } else {
    activeSrc = desktopImage || tabletImage || mobileImage || fallback;
  }

  const defaultAlt = car ? `${car.year} ${car.make} ${car.model}` : 'Car image';
  const resolvedAlt = alt !== undefined ? alt : defaultAlt;

  return (
    <Box
      component="picture"
      className={className}
      onClick={onClick}
      style={style}
      sx={{
        display: 'inline-block',
        width,
        height,
        overflow: 'hidden',
        ...sx,
      }}
    >
      {desktopImage && (
        <source
          media={`(min-width: ${theme.breakpoints.values.md}px)`}
          srcSet={desktopImage}
        />
      )}
      {tabletImage && (
        <source
          media={`(min-width: ${theme.breakpoints.values.sm}px) and (max-width: ${theme.breakpoints.values.md - 0.05}px)`}
          srcSet={tabletImage}
        />
      )}
      {mobileImage && (
        <source
          media={`(max-width: ${theme.breakpoints.values.sm - 0.05}px)`}
          srcSet={mobileImage}
        />
      )}
      <Box
        component="img"
        src={activeSrc}
        alt={resolvedAlt}
        loading={loading}
        sx={{
          width: '100%',
          height: '100%',
          aspectRatio,
          objectFit,
          display: 'block',
        }}
      />
    </Box>
  );
}
