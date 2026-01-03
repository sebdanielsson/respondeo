"use client";

/**
 * Image URL Input
 *
 * A composite input component for image URLs with:
 * - Text input for manual URL entry
 * - Image picker button (with tooltip when disabled)
 * - Image preview with loading skeleton
 */

import { useState, useEffect } from "react";
import Image from "next/image";
import { ImageIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImagePickerDialog } from "./image-picker-dialog";
import { getImageSearchEnabled } from "@/app/actions/search-images";

// ============================================================================
// Types
// ============================================================================

interface ImageUrlInputProps {
  /** The input id */
  id?: string;
  /** The current image URL value */
  value: string;
  /** Callback when the value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is required */
  required?: boolean;
  /** Whether to show the image preview */
  showPreview?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Image preview component with its own loading state.
 * Using key={url} on this component resets its internal state when URL changes.
 */
function ImagePreview({ url }: { url: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="bg-muted relative h-32 w-full overflow-hidden rounded-lg border">
        <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center">
          <ImageIcon className="mb-1 h-8 w-8 opacity-50" />
          <p className="text-xs">Failed to load image</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted relative h-32 w-full overflow-hidden rounded-lg border">
      {isLoading && <Skeleton className="absolute inset-0" />}
      <Image
        src={url}
        alt="Image preview"
        fill
        className={`object-contain transition-opacity ${isLoading ? "opacity-0" : "opacity-100"}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        sizes="(max-width: 640px) 100vw, 50vw"
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ImageUrlInput({
  id,
  value,
  onChange,
  placeholder = "https://example.com/image.jpg",
  disabled = false,
  required = false,
  showPreview = true,
}: ImageUrlInputProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = useState<boolean | null>(null);
  const [disabledReason, setDisabledReason] = useState<string>("");

  // Check if image search is enabled on mount
  useEffect(() => {
    let mounted = true;

    async function checkEnabled() {
      const result = await getImageSearchEnabled();
      if (mounted) {
        setIsSearchEnabled(result.enabled);
        setDisabledReason(result.reason ?? "");
      }
    }

    checkEnabled();

    return () => {
      mounted = false;
    };
  }, []);

  const handleImageSelect = (imageUrl: string) => {
    onChange(imageUrl);
    setIsPickerOpen(false);
  };

  const isButtonDisabled = disabled || isSearchEnabled === false;
  const showTooltip = isSearchEnabled === false;

  const pickerButton = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setIsPickerOpen(true)}
      disabled={isButtonDisabled}
      className="shrink-0"
      aria-label="Search for images"
    >
      <Search className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="flex-1"
        />

        {showTooltip ? (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex">{pickerButton}</span>} />
            <TooltipContent>
              <p>{disabledReason || "Image search is not available"}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          pickerButton
        )}
      </div>

      {/* Image Preview - key resets component state when URL changes */}
      {showPreview && value && <ImagePreview key={value} url={value} />}

      {/* Image Picker Dialog */}
      <ImagePickerDialog
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleImageSelect}
      />
    </div>
  );
}
