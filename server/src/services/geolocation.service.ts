/**
 * geolocation.service.ts
 * FraudShield Phase 12 — Indian city geodatabase + travel-feasibility detection.
 *
 * Provides:
 *  - getRandomCity()
 *  - getCityData(cityName)
 *  - calculateDistance(city1, city2)      — Haversine, returns km
 *  - isImpossibleTravel(c1, c2, minutes)  — max 900 km/h (commercial aviation cap)
 *  - getCitiesNearby(city, radiusKm)
 *
 * No external dependencies. All coordinates are real WGS-84 values.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CityData {
    name: string;
    state: string;
    latitude: number;
    longitude: number;
    /** Based on mock historical fraud rates */
    riskLevel: 'low' | 'medium' | 'high';
    fraudRatePercentage: number;
    majorBanks: string[];
}

// ---------------------------------------------------------------------------
// City Database (25 cities, 3 tiers)
// ---------------------------------------------------------------------------

const CITY_DATABASE: CityData[] = [
    // ── Tier 1: High fraud ──────────────────────────────────────────────────
    {
        name: 'Delhi',
        state: 'Delhi',
        latitude: 28.6139,
        longitude: 77.2090,
        riskLevel: 'high',
        fraudRatePercentage: 7.8,
        majorBanks: ['SBI', 'HDFC', 'ICICI', 'PNB', 'Axis'],
    },
    {
        name: 'Mumbai',
        state: 'Maharashtra',
        latitude: 19.0760,
        longitude: 72.8777,
        riskLevel: 'high',
        fraudRatePercentage: 7.1,
        majorBanks: ['HDFC', 'ICICI', 'Kotak', 'Axis', 'SBI'],
    },
    {
        name: 'Bangalore',
        state: 'Karnataka',
        latitude: 12.9716,
        longitude: 77.5946,
        riskLevel: 'high',
        fraudRatePercentage: 6.5,
        majorBanks: ['ICICI', 'HDFC', 'Canara', 'Axis', 'SBI'],
    },
    {
        name: 'Hyderabad',
        state: 'Telangana',
        latitude: 17.3850,
        longitude: 78.4867,
        riskLevel: 'high',
        fraudRatePercentage: 6.2,
        majorBanks: ['SBI', 'ICICI', 'HDFC', 'Andhra Bank', 'Axis'],
    },
    {
        name: 'Kolkata',
        state: 'West Bengal',
        latitude: 22.5726,
        longitude: 88.3639,
        riskLevel: 'high',
        fraudRatePercentage: 6.0,
        majorBanks: ['UCO Bank', 'SBI', 'Allahabad Bank', 'HDFC', 'ICICI'],
    },

    // ── Tier 2: Medium fraud ─────────────────────────────────────────────────
    {
        name: 'Pune',
        state: 'Maharashtra',
        latitude: 18.5204,
        longitude: 73.8567,
        riskLevel: 'medium',
        fraudRatePercentage: 4.5,
        majorBanks: ['HDFC', 'ICICI', 'Axis', 'SBI', 'Bank of Maharashtra'],
    },
    {
        name: 'Chennai',
        state: 'Tamil Nadu',
        latitude: 13.0827,
        longitude: 80.2707,
        riskLevel: 'medium',
        fraudRatePercentage: 4.2,
        majorBanks: ['Indian Bank', 'IOB', 'SBI', 'HDFC', 'ICICI'],
    },
    {
        name: 'Ahmedabad',
        state: 'Gujarat',
        latitude: 23.0225,
        longitude: 72.5714,
        riskLevel: 'medium',
        fraudRatePercentage: 3.9,
        majorBanks: ['Bank of Baroda', 'Dena Bank', 'HDFC', 'ICICI', 'SBI'],
    },
    {
        name: 'Surat',
        state: 'Gujarat',
        latitude: 21.1702,
        longitude: 72.8311,
        riskLevel: 'medium',
        fraudRatePercentage: 3.7,
        majorBanks: ['Bank of Baroda', 'SBI', 'HDFC', 'Axis'],
    },
    {
        name: 'Noida',
        state: 'Uttar Pradesh',
        latitude: 28.5355,
        longitude: 77.3910,
        riskLevel: 'medium',
        fraudRatePercentage: 3.5,
        majorBanks: ['HDFC', 'ICICI', 'Axis', 'SBI', 'PNB'],
    },
    {
        name: 'Gurgaon',
        state: 'Haryana',
        latitude: 28.4595,
        longitude: 77.0266,
        riskLevel: 'medium',
        fraudRatePercentage: 3.4,
        majorBanks: ['HDFC', 'ICICI', 'Kotak', 'Axis', 'SBI'],
    },
    {
        name: 'Kochi',
        state: 'Kerala',
        latitude: 9.9312,
        longitude: 76.2673,
        riskLevel: 'medium',
        fraudRatePercentage: 3.2,
        majorBanks: ['Federal Bank', 'SBT', 'SBI', 'HDFC', 'ICICI'],
    },

    // ── Tier 3: Low fraud ────────────────────────────────────────────────────
    {
        name: 'Jaipur',
        state: 'Rajasthan',
        latitude: 26.9124,
        longitude: 75.7873,
        riskLevel: 'low',
        fraudRatePercentage: 2.1,
        majorBanks: ['SBI', 'HDFC', 'Rajasthan Bank', 'ICICI'],
    },
    {
        name: 'Lucknow',
        state: 'Uttar Pradesh',
        latitude: 26.8467,
        longitude: 80.9462,
        riskLevel: 'low',
        fraudRatePercentage: 2.3,
        majorBanks: ['SBI', 'PNB', 'Allahabad Bank', 'HDFC'],
    },
    {
        name: 'Indore',
        state: 'Madhya Pradesh',
        latitude: 22.7196,
        longitude: 75.8577,
        riskLevel: 'low',
        fraudRatePercentage: 1.9,
        majorBanks: ['SBI', 'HDFC', 'Central Bank', 'ICICI'],
    },
    {
        name: 'Bhopal',
        state: 'Madhya Pradesh',
        latitude: 23.2599,
        longitude: 77.4126,
        riskLevel: 'low',
        fraudRatePercentage: 1.8,
        majorBanks: ['SBI', 'Central Bank', 'HDFC', 'PNB'],
    },
    {
        name: 'Nagpur',
        state: 'Maharashtra',
        latitude: 21.1458,
        longitude: 79.0882,
        riskLevel: 'low',
        fraudRatePercentage: 2.0,
        majorBanks: ['SBI', 'Bank of Maharashtra', 'HDFC', 'ICICI'],
    },
    {
        name: 'Chandigarh',
        state: 'Punjab',
        latitude: 30.7333,
        longitude: 76.7794,
        riskLevel: 'low',
        fraudRatePercentage: 1.7,
        majorBanks: ['SBI', 'PNB', 'HDFC', 'Axis'],
    },
    {
        name: 'Vadodara',
        state: 'Gujarat',
        latitude: 22.3072,
        longitude: 73.1812,
        riskLevel: 'low',
        fraudRatePercentage: 1.6,
        majorBanks: ['Bank of Baroda', 'SBI', 'HDFC', 'ICICI'],
    },
    {
        name: 'Visakhapatnam',
        state: 'Andhra Pradesh',
        latitude: 17.6868,
        longitude: 83.2185,
        riskLevel: 'low',
        fraudRatePercentage: 2.0,
        majorBanks: ['Andhra Bank', 'SBI', 'HDFC', 'ICICI'],
    },
    {
        name: 'Patna',
        state: 'Bihar',
        latitude: 25.5941,
        longitude: 85.1376,
        riskLevel: 'low',
        fraudRatePercentage: 2.4,
        majorBanks: ['SBI', 'PNB', 'Central Bank', 'HDFC'],
    },
    {
        name: 'Coimbatore',
        state: 'Tamil Nadu',
        latitude: 11.0168,
        longitude: 76.9558,
        riskLevel: 'low',
        fraudRatePercentage: 1.5,
        majorBanks: ['Indian Bank', 'IOB', 'SBI', 'HDFC'],
    },
    {
        name: 'Bhubaneswar',
        state: 'Odisha',
        latitude: 20.2961,
        longitude: 85.8245,
        riskLevel: 'low',
        fraudRatePercentage: 1.9,
        majorBanks: ['SBI', 'Bank of India', 'HDFC', 'ICICI'],
    },
    {
        name: 'Guwahati',
        state: 'Assam',
        latitude: 26.1445,
        longitude: 91.7362,
        riskLevel: 'low',
        fraudRatePercentage: 1.6,
        majorBanks: ['SBI', 'United Bank', 'HDFC', 'ICICI'],
    },
    {
        name: 'Ludhiana',
        state: 'Punjab',
        latitude: 30.9010,
        longitude: 75.8573,
        riskLevel: 'low',
        fraudRatePercentage: 1.4,
        majorBanks: ['SBI', 'PNB', 'HDFC', 'Axis'],
    },
    {
        name: 'Ranchi',
        state: 'Jharkhand',
        latitude: 23.3441,
        longitude: 85.3096,
        riskLevel: 'low',
        fraudRatePercentage: 2.1,
        majorBanks: ['SBI', 'Bank of India', 'HDFC'],
    },
];

// Pre-build a name→CityData map for O(1) lookup
const CITY_MAP = new Map<string, CityData>(
    CITY_DATABASE.map((c) => [c.name.toLowerCase(), c])
);

// ---------------------------------------------------------------------------
// Weighted sampling helpers
// ---------------------------------------------------------------------------

/**
 * Weights for random city selection:
 * Tier 1 (high): weight 5  — appear 5x more often (match real UPI volume distribution)
 * Tier 2 (medium): weight 3
 * Tier 3 (low): weight 1
 */
function cityWeight(city: CityData): number {
    if (city.riskLevel === 'high') return 5;
    if (city.riskLevel === 'medium') return 3;
    return 1;
}

// ---------------------------------------------------------------------------
// Haversine distance (km) — no external deps
// ---------------------------------------------------------------------------

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a weighted-random Indian city. Tier-1 cities appear more frequently
 * to reflect real UPI transaction volume distribution.
 *
 * @param rng - Optional seeded random function (returns 0–1). Defaults to Math.random.
 */
export function getRandomCity(rng: () => number = Math.random): CityData {
    const totalWeight = CITY_DATABASE.reduce((sum, c) => sum + cityWeight(c), 0);
    let pick = rng() * totalWeight;
    for (const city of CITY_DATABASE) {
        pick -= cityWeight(city);
        if (pick <= 0) return city;
    }
    return CITY_DATABASE[0];
}

/**
 * Returns the CityData for the given city name (case-insensitive), or undefined.
 */
export function getCityData(cityName: string): CityData | undefined {
    return CITY_MAP.get(cityName.toLowerCase());
}

/**
 * Calculates the great-circle distance in km between two cities.
 * Returns -1 if either city is not found in the database.
 */
export function calculateDistance(city1: string, city2: string): number {
    const c1 = getCityData(city1);
    const c2 = getCityData(city2);
    if (!c1 || !c2) return -1;
    return haversine(c1.latitude, c1.longitude, c2.latitude, c2.longitude);
}

/**
 * Returns true if travelling from city1 to city2 in timeDiffMinutes is
 * physically impossible at the maximum assumed speed of 900 km/h
 * (commercial aviation upper bound — includes same-city to airport transfer).
 */
export function isImpossibleTravel(
    city1: string,
    city2: string,
    timeDiffMinutes: number
): boolean {
    if (city1.toLowerCase() === city2.toLowerCase()) return false;
    const distKm = calculateDistance(city1, city2);
    if (distKm < 0) return false; // unknown city — can't determine
    const maxSpeedKmPerMin = 900 / 60; // 15 km/min
    const maxReachableDistKm = maxSpeedKmPerMin * timeDiffMinutes;
    return distKm > maxReachableDistKm;
}

/**
 * Returns all cities within radiusKm of the given city.
 */
export function getCitiesNearby(cityName: string, radiusKm: number): CityData[] {
    const origin = getCityData(cityName);
    if (!origin) return [];
    return CITY_DATABASE.filter((c) => {
        if (c.name.toLowerCase() === cityName.toLowerCase()) return false;
        const dist = haversine(origin.latitude, origin.longitude, c.latitude, c.longitude);
        return dist <= radiusKm;
    });
}

/**
 * Returns all city names in the database.
 */
export function getAllCityNames(): string[] {
    return CITY_DATABASE.map((c) => c.name);
}
