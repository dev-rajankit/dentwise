"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// "Dr. Aamish Husain" -> "AH". Drop the honorific first, otherwise every
// doctor's initials start with D.
function initialsFrom(name: string) {
  const parts = name
    .replace(/^\s*(dr|doctor|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);

  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

interface DoctorAvatarProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
}

/**
 * Doctor profile picture with a graceful fallback.
 *
 * The previous inline pattern was `imageUrl ? <Image/> : <initials/>`, which only
 * handles a MISSING url. When the url is present but the host is unreachable the
 * browser renders a broken-image glyph instead. Radix's AvatarImage unmounts
 * itself on load error, so AvatarFallback covers both cases.
 */
function DoctorAvatar({ name, imageUrl, className }: DoctorAvatarProps) {
  return (
    <Avatar className={cn("size-16", className)}>
      {imageUrl ? <AvatarImage src={imageUrl} alt={name} className="object-cover" /> : null}
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {initialsFrom(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export default DoctorAvatar;
