import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PromotionalBanner } from '@/hooks/usePromotionalBanners';

interface BannerCarouselProps {
  banners: PromotionalBanner[];
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({ banners }) => {
  // Only enable loop when there are multiple banners.
  // loop:true causes embla to clone DOM nodes which conflicts with
  // React 18 concurrent mode's multiple render passes (removeChild crash).
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: banners.length > 1 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Auto-play
  useEffect(() => {
    if (!emblaApi || banners.length <= 1) return;

    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [emblaApi, banners.length]);

  // Debug logging — must be inside useEffect, NOT at render level,
  // to avoid side-effects during concurrent mode's multiple render passes.
  useEffect(() => {
    if (banners.length === 0) {
      console.log('[BannerCarousel] No banners to display');
    } else {
      console.log('[BannerCarousel] Rendering', banners.length, 'banners:', banners.map(b => ({
        id: b.id,
        is_active: b.is_active,
        has_image: !!b.image_url,
        image_url: b.image_url,
      })));
    }
  }, [banners]);

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className="relative group">
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex">
          {banners.map((banner) => (
            <div key={banner.id} className="flex-[0_0_100%] min-w-0">
              <a
                href={banner.link_url || undefined}
                target={banner.link_url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={cn(
                  "block relative aspect-[3/1] w-full overflow-hidden",
                  banner.link_url && "cursor-pointer"
                )}
              >
                {banner.image_url ? (
                  <>
                    <img
                      src={banner.image_url}
                      alt={banner.title || 'Promotional banner'}
                      className="w-full h-full object-cover transition-opacity duration-300"
                      referrerPolicy="no-referrer"
                      onLoad={() => console.log('[BannerCarousel] ✅ Image loaded:', banner.image_url)}
                      onError={(e) => {
                        console.error('[BannerCarousel] ❌ Image failed to load:', banner.image_url);
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.querySelector('.banner-fallback')?.classList.remove('hidden');
                      }}
                    />
                    <div className="banner-fallback hidden absolute inset-0 bg-gradient-to-r from-muted to-muted/50 flex flex-col items-center justify-center gap-2 p-4">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground/70 break-all text-center max-w-sm">
                        Error al cargar imagen. URL: {banner.image_url?.substring(0, 80)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-primary/20 to-primary/10 flex items-center justify-center">
                    <span className="text-muted-foreground">Banner</span>
                  </div>
                )}

                {/* Overlay with text */}
                {(banner.title || banner.subtitle) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex items-center">
                    <div className="p-6 md:p-10 lg:p-12 max-w-xl">
                      {banner.title && (
                        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 drop-shadow-lg">
                          {banner.title}
                        </h2>
                      )}
                      {banner.subtitle && (
                        <p className="text-sm md:text-lg text-white/90 drop-shadow">
                          {banner.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            onClick={scrollNext}
            disabled={!canScrollNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === selectedIndex
                  ? "bg-white w-6"
                  : "bg-white/50 hover:bg-white/75"
              )}
              onClick={() => scrollTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;
