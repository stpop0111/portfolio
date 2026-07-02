export const curtainPalettes = {
  aboutMe      : [ 'bg-aboutme-950', 'bg-aboutme-770', 'bg-aboutme-590', 'bg-aboutme-410', 'bg-aboutme-230', 'bg-aboutme-50', ],
  works        : [ 'bg-works-950', 'bg-works-770', 'bg-works-590', 'bg-works-410', 'bg-works-230', 'bg-works-50', ],
  creative     : [ 'bg-creative-950', 'bg-creative-770', 'bg-creative-590', 'bg-creative-410', 'bg-creative-230', 'bg-creative-50', ],
  originalWorks: [ 'bg-original-950', 'bg-original-770', 'bg-original-590', 'bg-original-410', 'bg-original-230', 'bg-original-50', ],
  zinc         : [ 'bg-zinc-700', 'bg-zinc-600', 'bg-zinc-500', 'bg-zinc-400', 'bg-zinc-300', 'bg-zinc-200', ],
} satisfies Record<string, string[]>;

export type ThemeName = keyof typeof curtainPalettes;
