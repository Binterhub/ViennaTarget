'use strict';

const { FOCUS_ADDITIONAL_SPECIALIZATION } = require('./config');

/**
 * Deterministic sample doctors for local UI smoke when USE_MOCK_DATA=1
 * and DataMatcherAPI is not configured.
 */
function buildMockDoctors() {
  const focus = FOCUS_ADDITIONAL_SPECIALIZATION;
  const rows = [
    {
      evoid: 1001,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Univ.Prof. Dr.',
      firstname: 'Anna',
      lastname: 'Berger',
      city: 'Wien',
      specialization: 'Kinder- und Jugendheilkunde',
      additionalspecialization: focus,
    },
    {
      evoid: 1002,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Dr.',
      firstname: 'Tobias',
      lastname: 'Hofer',
      city: 'Graz',
      specialization: 'Kinder- und Jugendheilkunde',
      additionalspecialization: focus,
    },
    {
      evoid: 1003,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Dr.',
      firstname: 'Clara',
      lastname: 'Moser',
      city: 'Linz',
      specialization: 'Kinder- und Jugendheilkunde',
      additionalspecialization: focus,
    },
    {
      evoid: 1004,
      country: 'Austria',
      countrycode: 'AT',
      title: 'OA Dr.',
      firstname: 'Lukas',
      lastname: 'Steiner',
      city: 'Innsbruck',
      specialization: 'Kinder- und Jugendheilkunde',
      additionalspecialization: focus,
    },
    {
      evoid: 1005,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Dr.',
      firstname: 'Eva',
      lastname: 'Wagner',
      city: 'Salzburg',
      specialization: 'Kinder- und Jugendheilkunde',
      additionalspecialization: focus,
    },
    {
      evoid: 2001,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Univ.Prof. Dr.',
      firstname: 'Michael',
      lastname: 'Gnant',
      city: 'Wien',
      specialization: 'Allgemeinchirurgie und Viszeralchirurgie',
      additionalspecialization: 'Intensivmedizin',
    },
    {
      evoid: 2002,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Dr.',
      firstname: 'Sophie',
      lastname: 'Leitner',
      city: 'Wien',
      specialization: 'Innere Medizin',
      additionalspecialization: 'Kardiologie',
    },
    {
      evoid: 2003,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Dr.',
      firstname: 'Paul',
      lastname: 'Gruber',
      city: 'Graz',
      specialization: 'Anästhesiologie und Intensivmedizin',
      additionalspecialization: 'Intensivmedizin',
    },
    {
      evoid: 2004,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Mag. Dr.',
      firstname: 'Nina',
      lastname: 'Fuchs',
      city: 'Linz',
      specialization: 'Neurologie',
      additionalspecialization: '',
    },
    {
      evoid: 2005,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Dr.',
      firstname: 'David',
      lastname: 'Kaufmann',
      city: 'Wien',
      specialization: 'Kinder- und Jugendheilkunde',
      additionalspecialization: 'Neuropädiatrie',
    },
  ];

  // Expand for pagination testing
  for (let i = 1; i <= 40; i += 1) {
    rows.push({
      evoid: 3000 + i,
      country: 'Austria',
      countrycode: 'AT',
      title: 'Dr.',
      firstname: `Test${i}`,
      lastname: `Muster${String(i).padStart(2, '0')}`,
      city: i % 2 === 0 ? 'Wien' : 'Graz',
      specialization: i % 3 === 0 ? 'Innere Medizin' : 'Kinder- und Jugendheilkunde',
      additionalspecialization: i % 4 === 0 ? focus : i % 5 === 0 ? 'Intensivmedizin' : '',
    });
  }

  return rows;
}

function getMockPayload() {
  const doctors = buildMockDoctors();
  return {
    doctors,
    total: doctors.length,
    fetchedAt: new Date().toISOString(),
    fields: { postalCode: false, gender: false, postalKey: null, genderKey: null },
    focus: FOCUS_ADDITIONAL_SPECIALIZATION,
    country: 'Austria',
    mock: true,
  };
}

module.exports = { buildMockDoctors, getMockPayload };
