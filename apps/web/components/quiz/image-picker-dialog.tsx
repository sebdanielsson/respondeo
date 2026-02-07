"use client";

/**
 * Image Picker Dialog
 *
 * A dialog component that allows users to search and select images from web providers.
 * Displays results in a grid with proper attribution and selection highlighting.
 */

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import { Search, Loader2, ImageIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { searchImagesAction, triggerImageDownload } from "@/app/actions/search-images";
import type { ImageSearchResult } from "@/lib/images";

// ============================================================================
// Types
// ============================================================================

interface ImagePickerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Callback when an image is selected */
  onSelect: (imageUrl: string) => void;
}

// ============================================================================
// Sub-components
// ============================================================================

function ImageSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

interface ImageCardProps {
  image: ImageSearchResult;
  isSelected: boolean;
  onSelect: () => void;
}

function ImageCard({ image, isSelected, onSelect }: ImageCardProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
          isSelected
            ? "border-primary ring-primary ring-2"
            : "hover:border-muted-foreground/30 border-transparent"
        }`}
      >
        <div className="bg-muted relative aspect-video w-full overflow-hidden">
          {isLoading && <Skeleton className="absolute inset-0" />}
          <Image
            src={image.thumbnailUrl}
            alt={image.description}
            fill
            className={`object-cover transition-opacity ${isLoading ? "opacity-0" : "opacity-100"}`}
            onLoad={() => setIsLoading(false)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {isSelected && (
            <div className="bg-primary/80 absolute inset-0 flex items-center justify-center">
              <Check className="h-8 w-8 text-white" />
            </div>
          )}
        </div>
      </button>
      <p className="text-muted-foreground truncate px-0.5 text-xs">
        Photo by{" "}
        <a
          href={image.attribution.photographerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline underline-offset-2"
        >
          {image.attribution.photographerName}
        </a>{" "}
        on{" "}
        <a
          href={image.attribution.providerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline underline-offset-2"
        >
          {image.attribution.providerName}
        </a>
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ImagePickerDialog({ open, onOpenChange, onSelect }: ImagePickerDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [images, setImages] = useState<ImageSearchResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageSearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset state when dialog opens (use open as key to reset)
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Reset state when opening
      setQuery("");
      setImages([]);
      setSelectedImage(null);
      setHasSearched(false);
    }
    onOpenChange(newOpen);
  };

  const handleSearch = useCallback(() => {
    if (!query.trim()) {
      toast.error("Please enter a search query", {
        duration: Infinity,
      });
      return;
    }

    startTransition(async () => {
      const result = await searchImagesAction(query.trim());

      if (!result.success) {
        toast.error(result.error ?? "Failed to search for images", {
          duration: Infinity,
        });
        return;
      }

      setImages(result.images ?? []);
      setHasSearched(true);
      setSelectedImage(null);
    });
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isPending) {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleConfirm = async () => {
    if (selectedImage) {
      // Trigger download tracking (required by Unsplash API guidelines)
      if (selectedImage.downloadTrackingUrl) {
        try {
          await triggerImageDownload(selectedImage.downloadTrackingUrl);
        } catch (error) {
          // Log but don't block selection - tracking is best-effort
          console.error("Failed to trigger image download tracking:", error);
        }
      }
      onSelect(selectedImage.url);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    if (!isPending) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Search Images
          </DialogTitle>
          <DialogDescription>
            Search for images to add to your quiz. Images are provided by third-party services.
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Search for images..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPending}
          />
          <Button type="button" onClick={handleSearch} disabled={isPending || !query.trim()}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </div>

        {/* Results Grid */}
        <div className="max-h-[50vh] min-h-48 overflow-y-auto">
          {isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ImageSkeleton key={i} />
              ))}
            </div>
          ) : images.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {images.map((image) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  isSelected={selectedImage?.id === image.id}
                  onSelect={() => setSelectedImage(image)}
                />
              ))}
            </div>
          ) : hasSearched ? (
            <div className="text-muted-foreground flex h-48 flex-col items-center justify-center">
              <ImageIcon className="mb-2 h-12 w-12 opacity-50" />
              <p>No images found for &quot;{query}&quot;</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <div className="text-muted-foreground flex h-48 flex-col items-center justify-center">
              <Search className="mb-2 h-12 w-12 opacity-50" />
              <p>Enter a search term to find images</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selectedImage || isPending}>
            <Check className="h-4 w-4" />
            Select Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
