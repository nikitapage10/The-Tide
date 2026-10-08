"use client";
/**
 * The world's name, arriving the way names do on this site: in the Tide's
 * script first, then resolving into English. Ilyr, from the Teruānga for
 * "light that remains".
 */
import { Decode } from "@/components/glyphs/Decode";
import { WORLD_NAME, WORLD_NAME_MEANING, WORLD_NAME_PRONUNCIATION } from "@/lib/domain/world-name";

export function WorldName({ className = "" }: { className?: string }) {
  return (
    <span className={`world-name-text ${className}`} title={`${WORLD_NAME} (${WORLD_NAME_PRONUNCIATION}): “${WORLD_NAME_MEANING}”`}>
      <Decode text={WORLD_NAME} active delay={300} />
    </span>
  );
}
