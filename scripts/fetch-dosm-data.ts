import fs from 'fs';
import path from 'path';

interface ApiRecord {
  age: string;
  sex: string;
  date: string;
  ethnicity: string;
  population: number;
}

async function fetchDosmData() {
  const url = 'https://api.data.gov.my/data-catalogue?id=population_malaysia&limit=25000';
  console.log(`Fetching DOSM population data from: ${url}`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.statusText}`);
    }
    const data = (await res.json()) as ApiRecord[];
    console.log(`Fetched ${data.length} records.`);

    // Filter by sex === "both"
    const bothSexRecords = data.filter(r => r.sex === 'both');

    // Find latest date
    const uniqueDates = [...new Set(bothSexRecords.map(r => r.date))].sort();
    if (uniqueDates.length === 0) {
      throw new Error('No records found with sex = both');
    }
    const latestDate = uniqueDates[uniqueDates.length - 1];
    console.log(`Filtering for latest date: ${latestDate}`);

    const latestRecords = bothSexRecords.filter(r => r.date === latestDate);

    // Ethnicity groups to include (excluding overall, bumi, other)
    const targetEthnicities = [
      'bumi_malay',
      'bumi_other',
      'chinese',
      'indian',
      'other_citizen',
      'other_noncitizen'
    ];

    // Function to get population for a specific ethnicity and age band
    const getPop = (ethnicity: string, ageBand: string): number => {
      const rec = latestRecords.find(r => r.ethnicity === ethnicity && r.age === ageBand);
      return rec ? rec.population : 0;
    };

    // Calculate aggregated broad bands for each target ethnicity
    const ethnicityData: Record<string, { [key: string]: number }> = {};
    let totalAdultPop = 0;

    for (const eth of targetEthnicities) {
      const pop_15_19 = getPop(eth, '15-19');
      const pop_20_24 = getPop(eth, '20-24');
      const pop_25_29 = getPop(eth, '25-29');
      const pop_30_34 = getPop(eth, '30-34');
      const pop_35_39 = getPop(eth, '35-39');
      const pop_40_44 = getPop(eth, '40-44');
      const pop_45_49 = getPop(eth, '45-49');
      const pop_50_54 = getPop(eth, '50-54');
      const pop_55_59 = getPop(eth, '55-59');
      const pop_60_64 = getPop(eth, '60-64');
      const pop_65_69 = getPop(eth, '65-69');
      const pop_70_74 = getPop(eth, '70-74');
      const pop_75_79 = getPop(eth, '75-79');
      const pop_80_84 = getPop(eth, '80-84');
      const pop_85_plus = getPop(eth, '85+');

      const p_18_30 = 0.4 * pop_15_19 + pop_20_24 + pop_25_29 + 0.2 * pop_30_34;
      const p_31_45 = 0.8 * pop_30_34 + pop_35_39 + pop_40_44 + 0.2 * pop_45_49;
      const p_46_60 = 0.8 * pop_45_49 + pop_50_54 + pop_55_59 + 0.2 * pop_60_64;
      const p_61_plus = 0.8 * pop_60_64 + pop_65_69 + pop_70_74 + pop_75_79 + pop_80_84 + pop_85_plus;

      ethnicityData[eth] = {
        '18-30': p_18_30,
        '31-45': p_31_45,
        '46-60': p_46_60,
        '61+': p_61_plus
      };

      totalAdultPop += (p_18_30 + p_31_45 + p_46_60 + p_61_plus);
    }

    console.log(`Total calculated adult population (18+): ${totalAdultPop.toFixed(2)} thousand`);

    // Calculate weights
    const weights: Record<string, number> = {};
    for (const eth of targetEthnicities) {
      for (const band of ['18-30', '31-45', '46-60', '61+']) {
        const val = ethnicityData[eth][band];
        const weight = val / totalAdultPop;
        weights[`${eth}_${band}`] = parseFloat(weight.toFixed(6));
      }
    }

    const result = {
      lastFetched: new Date().toISOString(),
      source: 'https://api.data.gov.my/data-catalogue?id=population_malaysia',
      weights
    };

    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputPath = path.join(dataDir, 'dosm-demographics.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Successfully saved demographics cache to: ${outputPath}`);

  } catch (error) {
    console.error('Error fetching/processing demographics data:', error);
    process.exit(1);
  }
}

fetchDosmData();
