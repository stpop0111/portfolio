export function SplitText({ text = 'example', className = '' }: { text: string; className?: string }) {
  return text.split('').map((char, i) => (
    <span key={i} className={`inline-block overflow-hidden ${className}`}>
      {char === ' ' ? '\u00A0' : char}
    </span>
  ));
}