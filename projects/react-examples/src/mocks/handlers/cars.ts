import { http, HttpResponse } from 'msw';

const brands = ['toyota', 'bmw', 'mercedes'];
const cars: Record<string, Array<{ value: string; label: string }>> = {
  toyota: [
    { value: 'camry', label: 'Camry' },
    { value: 'corolla', label: 'Corolla' },
    { value: 'rav4', label: 'RAV4' },
    { value: 'land_cruiser', label: 'Land Cruiser' },
  ],
  bmw: [
    { value: '3_series', label: '3 Series' },
    { value: '5_series', label: '5 Series' },
    { value: 'x5', label: 'X5' },
  ],
  mercedes: [
    { value: 'c_class', label: 'C-Class' },
    { value: 'e_class', label: 'E-Class' },
    { value: 'glc', label: 'GLC' },
  ],
};

export const handlers = [
  http.get('/cars', ({ request }) => {
    const url = new URL(request.url);
    const brand = url.searchParams.get('brand')?.toLocaleLowerCase();
    const foundedBrand = brands.find((b) => brand && b.toLocaleLowerCase().includes(brand));
    const foundedCars = foundedBrand && cars[foundedBrand];

    if (!foundedCars) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(foundedCars);
  }),
];
