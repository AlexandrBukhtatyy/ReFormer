export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'none';

export interface Property {
  id?: string;
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}
