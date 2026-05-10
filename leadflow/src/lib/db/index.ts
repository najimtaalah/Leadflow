export { prisma } from './prisma';

export function initDb(): void {
  // Prisma connects lazily; seeding is handled by prisma db seed at container startup.
}
