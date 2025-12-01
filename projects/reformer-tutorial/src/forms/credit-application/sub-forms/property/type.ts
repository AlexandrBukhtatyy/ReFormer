export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'car' | 'other';

export interface Property {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}
