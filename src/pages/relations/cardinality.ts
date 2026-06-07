export function formatCardinality(cardinality: string): string {
  switch (cardinality) {
    case 'ExactlyOne':
      return '1';
    case 'ZeroOne':
      return '0..1';
    case 'OneMore':
      return '1..n';
    case 'ZeroMore':
      return 'n';
    default:
      return cardinality || '?';
  }
}
