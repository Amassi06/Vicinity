export function styleForNeighbourhoodId(id: string): { color: string; fillOpacity: number } {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return { color: `hsl(${hue} 70% 45%)`, fillOpacity: 0.28 };
}
