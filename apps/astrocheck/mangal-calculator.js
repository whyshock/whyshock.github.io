/**
 * Mangal Dosha Calculator v1.0
 * Client-side Vedic Astrology Calculations
 * Uses Sidereal Zodiac (Nirayana) with Lahiri Ayanamsa
 */

(function() {
    'use strict';

    // Zodiac Signs
    const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
                   'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    
    const SIGNS_SANSKRIT = ['Mesha', 'Vrishaba', 'Mithuna', 'Karka', 'Simha', 'Kanya',
                            'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
    
    const SYMBOLS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

    // Nakshatra names
    const NAKSHATRAS = [
        'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
        'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
        'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
        'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
        'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
    ];

    // Mangal Dosha houses (from Lagna, Moon, and Venus)
    const MANGAL_DOSHA_HOUSES = [1, 2, 4, 7, 8, 12];

    // Signs where Mars is strong (own sign or exalted) - can cancel dosha
    const MARS_STRONG_SIGNS = [0, 7, 9]; // Aries, Scorpio, Capricorn (0-indexed)

    /**
     * Calculate Julian Day Number from date and time
     */
    function getJulianDay(year, month, day, hour, minute, timezone) {
        // Convert to UTC
        const utcHour = hour - timezone + minute / 60;
        
        // Adjust for UTC day change
        let adjustedDay = day + utcHour / 24;
        let adjustedMonth = month;
        let adjustedYear = year;
        
        if (adjustedMonth <= 2) {
            adjustedYear -= 1;
            adjustedMonth += 12;
        }
        
        const A = Math.floor(adjustedYear / 100);
        const B = 2 - A + Math.floor(A / 4);
        
        const JD = Math.floor(365.25 * (adjustedYear + 4716)) + 
                   Math.floor(30.6001 * (adjustedMonth + 1)) + 
                   adjustedDay + B - 1524.5;
        
        return JD;
    }

    /**
     * Calculate Lahiri Ayanamsa for a given Julian Day
     * Lahiri Ayanamsa formula
     */
    function getLahiriAyanamsa(jd) {
        const T = (jd - 2451545.0) / 36525.0; // Julian centuries from J2000
        
        // Lahiri Ayanamsa formula (in degrees)
        // Based on mean precession with reference point at 285° for 1900
        const ayanamsa = 23.85 + 0.0137 * (jd - 2415020) / 365.25;
        
        // More accurate formula
        const precession = 50.27 + 0.000222 * T; // arcseconds per year
        const years = (jd - 2415020) / 365.25; // Years from 1900
        const ayan = 22.460148 + (years * precession / 3600);
        
        return ayan;
    }

    /**
     * Calculate Sun's longitude using simplified VSOP87
     */
    function getSunLongitude(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        
        // Mean longitude
        let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        L0 = normalizeAngle(L0);
        
        // Mean anomaly
        let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
        M = normalizeAngle(M);
        const MRad = M * Math.PI / 180;
        
        // Equation of center
        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(MRad) +
                  (0.019993 - 0.000101 * T) * Math.sin(2 * MRad) +
                  0.000289 * Math.sin(3 * MRad);
        
        // True longitude
        const sunLong = L0 + C;
        
        return normalizeAngle(sunLong);
    }

    /**
     * Calculate Moon's longitude using simplified ELP2000
     */
    function getMoonLongitude(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        
        // Mean longitude
        let L = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841;
        L = normalizeAngle(L);
        
        // Mean anomaly of Moon
        let M = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699;
        M = normalizeAngle(M);
        const MRad = M * Math.PI / 180;
        
        // Mean elongation
        let D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868;
        D = normalizeAngle(D);
        const DRad = D * Math.PI / 180;
        
        // Mean anomaly of Sun
        let Ms = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
        Ms = normalizeAngle(Ms);
        const MsRad = Ms * Math.PI / 180;
        
        // Argument of latitude
        let F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;
        F = normalizeAngle(F);
        const FRad = F * Math.PI / 180;
        
        // Principal periodic terms
        const longitude = L + 
            6.289 * Math.sin(MRad) +
            1.274 * Math.sin(2 * DRad - MRad) +
            0.658 * Math.sin(2 * DRad) +
            0.214 * Math.sin(2 * MRad) -
            0.186 * Math.sin(MsRad) -
            0.114 * Math.sin(2 * FRad);
        
        return normalizeAngle(longitude);
    }

    /**
     * Calculate Mars longitude using simplified VSOP87
     */
    function getMarsLongitude(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        
        // Mean longitude
        let L0 = 355.433275 + 19140.2993313 * T + 0.00000262 * T * T;
        L0 = normalizeAngle(L0);
        
        // Mean anomaly
        let M = 19.373537 + 19139.8585747 * T + 0.00000145 * T * T;
        M = normalizeAngle(M);
        const MRad = M * Math.PI / 180;
        
        // Equation of center
        const C = 10.691 * Math.sin(MRad) +
                  0.623 * Math.sin(2 * MRad) +
                  0.050 * Math.sin(3 * MRad);
        
        return normalizeAngle(L0 + C);
    }

    /**
     * Calculate Jupiter longitude
     */
    function getJupiterLongitude(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        
        let L0 = 34.351519 + 3034.9056606 * T - 0.00008501 * T * T;
        L0 = normalizeAngle(L0);
        
        let M = 20.020564 + 3034.6874893 * T + 0.00017477 * T * T;
        M = normalizeAngle(M);
        const MRad = M * Math.PI / 180;
        
        const C = 5.555 * Math.sin(MRad) +
                  0.168 * Math.sin(2 * MRad);
        
        return normalizeAngle(L0 + C);
    }

    /**
     * Calculate Venus longitude
     */
    function getVenusLongitude(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        
        let L0 = 181.979801 + 58517.8156760 * T + 0.00000165 * T * T;
        L0 = normalizeAngle(L0);
        
        let M = 50.416772 + 58517.8038795 * T + 0.00000132 * T * T;
        M = normalizeAngle(M);
        const MRad = M * Math.PI / 180;
        
        const C = 0.7758 * Math.sin(MRad) +
                  0.0033 * Math.sin(2 * MRad);
        
        return normalizeAngle(L0 + C);
    }

    /**
     * Calculate Saturn longitude
     */
    function getSaturnLongitude(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        
        let L0 = 50.077444 + 1222.1138488 * T + 0.00021004 * T * T;
        L0 = normalizeAngle(L0);
        
        let M = 317.021290 + 1222.1139601 * T + 0.00000889 * T * T;
        M = normalizeAngle(M);
        const MRad = M * Math.PI / 180;
        
        const C = 6.406 * Math.sin(MRad) +
                  0.318 * Math.sin(2 * MRad);
        
        return normalizeAngle(L0 + C);
    }

    /**
     * Calculate Mercury longitude
     */
    function getMercuryLongitude(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        
        let L0 = 252.250906 + 149472.6746358 * T - 0.00000536 * T * T;
        L0 = normalizeAngle(L0);
        
        let M = 174.795330 + 149472.5153900 * T - 0.00001238 * T * T;
        M = normalizeAngle(M);
        const MRad = M * Math.PI / 180;
        
        const C = 23.440 * Math.sin(MRad) +
                  2.9818 * Math.sin(2 * MRad) +
                  0.5255 * Math.sin(3 * MRad);
        
        return normalizeAngle(L0 + C);
    }

    /**
     * Calculate Ascendant (Lagna)
     */
    function getAscendant(jd, latitude, longitude, timezone) {
        // Convert to local sidereal time
        const T = (jd - 2451545.0) / 36525.0;
        
        // Greenwich Mean Sidereal Time at 0h UT
        let GMST = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 
                   0.000387933 * T * T - T * T * T / 38710000;
        GMST = normalizeAngle(GMST);
        
        // Local Sidereal Time
        let LST = GMST + longitude;
        LST = normalizeAngle(LST);
        
        // Calculate obliquity of ecliptic
        const eps = 23.439291 - 0.0130042 * T;
        const epsRad = eps * Math.PI / 180;
        const latRad = latitude * Math.PI / 180;
        const lstRad = LST * Math.PI / 180;
        
        // Ascendant formula
        const y = -Math.cos(lstRad);
        const x = Math.sin(epsRad) * Math.tan(latRad) + Math.cos(epsRad) * Math.sin(lstRad);
        
        let asc = Math.atan2(y, x) * 180 / Math.PI;
        asc = normalizeAngle(asc);
        
        return asc;
    }

    /**
     * Normalize angle to 0-360 degrees
     */
    function normalizeAngle(angle) {
        while (angle < 0) angle += 360;
        while (angle >= 360) angle -= 360;
        return angle;
    }

    /**
     * Get sign number (0-11) from longitude
     */
    function getSign(longitude) {
        return Math.floor(longitude / 30);
    }

    /**
     * Get degree within sign (0-30)
     */
    function getDegreeInSign(longitude) {
        return longitude % 30;
    }

    /**
     * Get house number (1-12) relative to ascendant
     */
    function getHouse(planetLong, ascendant) {
        const ascSign = getSign(ascendant);
        const planetSign = getSign(planetLong);
        
        let house = planetSign - ascSign + 1;
        if (house <= 0) house += 12;
        if (house > 12) house -= 12;
        
        return house;
    }

    /**
     * Get Nakshatra from longitude
     */
    function getNakshatra(longitude) {
        const nakshatraNum = Math.floor(longitude / (360 / 27));
        const pada = Math.floor((longitude % (360 / 27)) / (360 / 108)) + 1;
        return {
            number: nakshatraNum + 1,
            name: NAKSHATRAS[nakshatraNum],
            pada: pada
        };
    }

    /**
     * Check if Jupiter aspects Mars (reduces Mangal Dosha)
     */
    function isJupiterAspectingMars(jupiterHouse, marsHouse) {
        // Jupiter aspects 5th, 7th, and 9th houses from its position
        const jupiterAspects = [
            jupiterHouse,
            ((jupiterHouse + 4 - 1) % 12) + 1,  // 5th
            ((jupiterHouse + 6 - 1) % 12) + 1,  // 7th
            ((jupiterHouse + 8 - 1) % 12) + 1   // 9th
        ];
        
        return jupiterAspects.includes(marsHouse);
    }

    /**
     * Check if Mars is conjunct with Jupiter
     */
    function isConjunctWithJupiter(marsLong, jupiterLong) {
        const diff = Math.abs(marsLong - jupiterLong);
        return diff < 10 || diff > 350; // Within 10 degrees
    }

    /**
     * Main calculation function
     */
    function calculateMangalDosha(dateStr, timeStr, latitude, longitude, timezone) {
        // Parse date and time
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        
        // Calculate Julian Day
        const jd = getJulianDay(year, month, day, hour, minute, timezone);
        
        // Get Lahiri Ayanamsa
        const ayanamsa = getLahiriAyanamsa(jd);
        
        // Calculate tropical positions
        const sunTropical = getSunLongitude(jd);
        const moonTropical = getMoonLongitude(jd);
        const marsTropical = getMarsLongitude(jd);
        const jupiterTropical = getJupiterLongitude(jd);
        const venusTropical = getVenusLongitude(jd);
        const saturnTropical = getSaturnLongitude(jd);
        const mercuryTropical = getMercuryLongitude(jd);
        const ascTropical = getAscendant(jd, latitude, longitude, timezone);
        
        // Convert to sidereal (subtract ayanamsa)
        const sun = normalizeAngle(sunTropical - ayanamsa);
        const moon = normalizeAngle(moonTropical - ayanamsa);
        const mars = normalizeAngle(marsTropical - ayanamsa);
        const jupiter = normalizeAngle(jupiterTropical - ayanamsa);
        const venus = normalizeAngle(venusTropical - ayanamsa);
        const saturn = normalizeAngle(saturnTropical - ayanamsa);
        const mercury = normalizeAngle(mercuryTropical - ayanamsa);
        const ascendant = normalizeAngle(ascTropical - ayanamsa);
        
        // Get signs
        const lagnaSign = getSign(ascendant);
        const marsSign = getSign(mars);
        const moonSign = getSign(moon);
        const jupiterSign = getSign(jupiter);
        const venusSign = getSign(venus);
        
        // Get houses (from Lagna)
        const marsHouseFromLagna = getHouse(mars, ascendant);
        const marsHouseFromMoon = getHouse(mars, moon);
        const marsHouseFromVenus = getHouse(mars, venus);
        const jupiterHouse = getHouse(jupiter, ascendant);
        
        // Check Mangal Dosha from different references
        const isManglikFromLagna = MANGAL_DOSHA_HOUSES.includes(marsHouseFromLagna);
        const isManglikFromMoon = MANGAL_DOSHA_HOUSES.includes(marsHouseFromMoon);
        const isManglikFromVenus = MANGAL_DOSHA_HOUSES.includes(marsHouseFromVenus);
        
        // Overall Manglik status
        const isManglik = isManglikFromLagna || isManglikFromMoon || isManglikFromVenus;
        
        // Check cancellation conditions
        let cancellationReasons = [];
        let isCancelled = false;
        
        if (isManglik) {
            // 1. Mars in own sign (Aries, Scorpio) or exaltation (Capricorn)
            if (MARS_STRONG_SIGNS.includes(marsSign)) {
                isCancelled = true;
                const signName = SIGNS[marsSign];
                if (marsSign === 0 || marsSign === 7) {
                    cancellationReasons.push(`Mars is in own sign (${signName})`);
                } else {
                    cancellationReasons.push(`Mars is exalted in ${signName}`);
                }
            }
            
            // 2. Jupiter aspects Mars
            if (isJupiterAspectingMars(jupiterHouse, marsHouseFromLagna)) {
                isCancelled = true;
                cancellationReasons.push('Jupiter aspects Mars');
            }
            
            // 3. Mars is conjunct with Jupiter
            if (isConjunctWithJupiter(mars, jupiter)) {
                isCancelled = true;
                cancellationReasons.push('Mars is conjunct with Jupiter');
            }
            
            // 4. Mars in Leo or Aquarius (some traditions)
            if (marsSign === 4 || marsSign === 10) {
                cancellationReasons.push(`Mars in ${SIGNS[marsSign]} (partial cancellation in some traditions)`);
            }
            
            // 5. If both partners are Manglik (checked at matching time)
        }
        
        // Get Moon nakshatra
        const moonNakshatra = getNakshatra(moon);
        
        // Build result
        const result = {
            isManglik: isManglik,
            isCancelled: isCancelled,
            partialManglik: isManglik && (isCancelled || cancellationReasons.length > 0),
            
            houseOfMars: {
                fromLagna: marsHouseFromLagna,
                fromMoon: marsHouseFromMoon,
                fromVenus: marsHouseFromVenus
            },
            
            manglikStatus: {
                fromLagna: isManglikFromLagna,
                fromMoon: isManglikFromMoon,
                fromVenus: isManglikFromVenus
            },
            
            cancellationReasons: cancellationReasons,
            
            planets: {
                sun: { longitude: sun, sign: getSign(sun), signName: SIGNS[getSign(sun)], degree: getDegreeInSign(sun) },
                moon: { longitude: moon, sign: getSign(moon), signName: SIGNS[getSign(moon)], degree: getDegreeInSign(moon) },
                mars: { longitude: mars, sign: getSign(mars), signName: SIGNS[getSign(mars)], degree: getDegreeInSign(mars) },
                mercury: { longitude: mercury, sign: getSign(mercury), signName: SIGNS[getSign(mercury)], degree: getDegreeInSign(mercury) },
                jupiter: { longitude: jupiter, sign: getSign(jupiter), signName: SIGNS[getSign(jupiter)], degree: getDegreeInSign(jupiter) },
                venus: { longitude: venus, sign: getSign(venus), signName: SIGNS[getSign(venus)], degree: getDegreeInSign(venus) },
                saturn: { longitude: saturn, sign: getSign(saturn), signName: SIGNS[getSign(saturn)], degree: getDegreeInSign(saturn) },
                ascendant: { longitude: ascendant, sign: lagnaSign, signName: SIGNS[lagnaSign], degree: getDegreeInSign(ascendant) }
            },
            
            moonRashi: {
                sign: moonSign + 1,
                signName: SIGNS[moonSign],
                signSanskrit: SIGNS_SANSKRIT[moonSign],
                symbol: SYMBOLS[moonSign]
            },
            
            moonNakshatra: moonNakshatra,
            
            ayanamsa: ayanamsa,
            julianDay: jd,
            
            description: generateDescription(isManglik, isCancelled, marsHouseFromLagna, marsSign, cancellationReasons)
        };
        
        return result;
    }

    /**
     * Generate human-readable description
     */
    function generateDescription(isManglik, isCancelled, marsHouse, marsSign, cancellationReasons) {
        if (!isManglik) {
            return "Mars is not placed in houses 1, 2, 4, 7, 8, or 12 from the Ascendant. You are NOT Manglik. There is no Mangal Dosha in your chart.";
        }
        
        let desc = `Mars is placed in the ${getOrdinal(marsHouse)} house from Ascendant in ${SIGNS[marsSign]}. `;
        desc += "This indicates the presence of Mangal Dosha (Kuja Dosha). ";
        
        if (isCancelled) {
            desc += "However, this dosha is CANCELLED due to: " + cancellationReasons.join(', ') + ". ";
            desc += "The negative effects of Mangal Dosha are significantly reduced or nullified.";
        } else if (cancellationReasons.length > 0) {
            desc += "There are some mitigating factors: " + cancellationReasons.join(', ') + ". ";
            desc += "This is considered PARTIAL Mangal Dosha with reduced intensity.";
        } else {
            desc += "Traditional remedies may be recommended before marriage. Consider matching with another Manglik person for dosha cancellation.";
        }
        
        return desc;
    }

    /**
     * Get ordinal suffix
     */
    function getOrdinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    /**
     * Display results
     */
    function displayResults(result, birthPlace) {
        const resultsDiv = document.getElementById('mangal-results');
        
        // Determine card class
        let cardClass = 'result-card ';
        let badgeClass = 'manglik-badge ';
        let statusText = '';
        
        if (!result.isManglik) {
            cardClass += 'non-manglik';
            badgeClass += 'no';
            statusText = '✓ Non-Manglik';
        } else if (result.isCancelled) {
            cardClass += 'cancelled';
            badgeClass += 'partial';
            statusText = '⚡ Manglik (Cancelled)';
        } else if (result.partialManglik) {
            cardClass += 'cancelled';
            badgeClass += 'partial';
            statusText = '△ Partial Manglik';
        } else {
            cardClass += 'manglik';
            badgeClass += 'yes';
            statusText = '🔥 Manglik';
        }
        
        let html = `
            <div class="${cardClass}" style="text-align: center;">
                <h3 style="color: var(--star-gold); margin-bottom: 10px;">Mangal Dosha Result</h3>
                ${birthPlace ? `<p style="opacity: 0.7; margin-bottom: 15px;">Birth Place: ${birthPlace}</p>` : ''}
                <div class="${badgeClass}">${statusText}</div>
                <p style="font-size: 1.1rem; line-height: 1.7; margin-top: 20px;">${result.description}</p>
            </div>
            
            <div class="result-card">
                <h3 style="color: var(--star-gold); margin-bottom: 20px; text-align: center;">Birth Chart Summary</h3>
                
                <div style="text-align: center; margin-bottom: 20px;">
                    <p style="font-size: 1.2rem;">
                        <strong>Moon Sign (Rashi):</strong> 
                        <span style="color: var(--celestial-blue);">${result.moonRashi.symbol} ${result.moonRashi.signName} (${result.moonRashi.signSanskrit})</span>
                    </p>
                    <p style="margin-top: 10px;">
                        <strong>Nakshatra:</strong> 
                        <span style="color: var(--nebula-pink);">${result.moonNakshatra.name} (Pada ${result.moonNakshatra.pada})</span>
                    </p>
                </div>
                
                <h4 style="color: var(--star-gold); margin: 20px 0 15px; text-align: center;">Mars Position Analysis</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; text-align: center;">
                    <div style="background: rgba(255, 99, 71, 0.1); padding: 15px; border-radius: 10px;">
                        <div style="font-weight: bold; color: #ff6347;">From Lagna</div>
                        <div style="font-size: 1.3rem; margin: 10px 0;">${getOrdinal(result.houseOfMars.fromLagna)} House</div>
                        <div style="color: ${result.manglikStatus.fromLagna ? '#ff6347' : '#4ade80'};">
                            ${result.manglikStatus.fromLagna ? '⚠ Manglik Position' : '✓ Safe Position'}
                        </div>
                    </div>
                    <div style="background: rgba(192, 192, 192, 0.1); padding: 15px; border-radius: 10px;">
                        <div style="font-weight: bold; color: #c0c0c0;">From Moon</div>
                        <div style="font-size: 1.3rem; margin: 10px 0;">${getOrdinal(result.houseOfMars.fromMoon)} House</div>
                        <div style="color: ${result.manglikStatus.fromMoon ? '#ff6347' : '#4ade80'};">
                            ${result.manglikStatus.fromMoon ? '⚠ Manglik Position' : '✓ Safe Position'}
                        </div>
                    </div>
                    <div style="background: rgba(255, 182, 193, 0.1); padding: 15px; border-radius: 10px;">
                        <div style="font-weight: bold; color: #ffb6c1;">From Venus</div>
                        <div style="font-size: 1.3rem; margin: 10px 0;">${getOrdinal(result.houseOfMars.fromVenus)} House</div>
                        <div style="color: ${result.manglikStatus.fromVenus ? '#ff6347' : '#4ade80'};">
                            ${result.manglikStatus.fromVenus ? '⚠ Manglik Position' : '✓ Safe Position'}
                        </div>
                    </div>
                </div>
                
                <h4 style="color: var(--star-gold); margin: 25px 0 15px; text-align: center;">Planetary Positions (Sidereal/Nirayana)</h4>
                <div class="planet-positions">
                    <div class="planet-pos">
                        <div class="planet-name">☉ Sun</div>
                        <div class="planet-sign">${SYMBOLS[result.planets.sun.sign]} ${result.planets.sun.signName}</div>
                        <div class="planet-house">${result.planets.sun.degree.toFixed(1)}°</div>
                    </div>
                    <div class="planet-pos" style="border: 1px solid #c0c0c0;">
                        <div class="planet-name">☽ Moon</div>
                        <div class="planet-sign">${SYMBOLS[result.planets.moon.sign]} ${result.planets.moon.signName}</div>
                        <div class="planet-house">${result.planets.moon.degree.toFixed(1)}°</div>
                    </div>
                    <div class="planet-pos" style="border: 1px solid #ff6347;">
                        <div class="planet-name" style="color: #ff6347;">♂ Mars</div>
                        <div class="planet-sign">${SYMBOLS[result.planets.mars.sign]} ${result.planets.mars.signName}</div>
                        <div class="planet-house">${result.planets.mars.degree.toFixed(1)}°</div>
                    </div>
                    <div class="planet-pos">
                        <div class="planet-name">☿ Mercury</div>
                        <div class="planet-sign">${SYMBOLS[result.planets.mercury.sign]} ${result.planets.mercury.signName}</div>
                        <div class="planet-house">${result.planets.mercury.degree.toFixed(1)}°</div>
                    </div>
                    <div class="planet-pos">
                        <div class="planet-name" style="color: #ff8c00;">♃ Jupiter</div>
                        <div class="planet-sign">${SYMBOLS[result.planets.jupiter.sign]} ${result.planets.jupiter.signName}</div>
                        <div class="planet-house">${result.planets.jupiter.degree.toFixed(1)}°</div>
                    </div>
                    <div class="planet-pos">
                        <div class="planet-name" style="color: #ffb6c1;">♀ Venus</div>
                        <div class="planet-sign">${SYMBOLS[result.planets.venus.sign]} ${result.planets.venus.signName}</div>
                        <div class="planet-house">${result.planets.venus.degree.toFixed(1)}°</div>
                    </div>
                    <div class="planet-pos">
                        <div class="planet-name" style="color: #daa520;">♄ Saturn</div>
                        <div class="planet-sign">${SYMBOLS[result.planets.saturn.sign]} ${result.planets.saturn.signName}</div>
                        <div class="planet-house">${result.planets.saturn.degree.toFixed(1)}°</div>
                    </div>
                    <div class="planet-pos" style="border: 1px solid var(--star-gold);">
                        <div class="planet-name">↑ Lagna</div>
                        <div class="planet-sign">${SYMBOLS[result.planets.ascendant.sign]} ${result.planets.ascendant.signName}</div>
                        <div class="planet-house">${result.planets.ascendant.degree.toFixed(1)}°</div>
                    </div>
                </div>
                
                <p style="text-align: center; font-size: 0.85rem; opacity: 0.6; margin-top: 15px;">
                    Lahiri Ayanamsa: ${result.ayanamsa.toFixed(4)}° | Julian Day: ${result.julianDay.toFixed(4)}
                </p>
            </div>
        `;
        
        // Add remedies section if Manglik
        if (result.isManglik && !result.isCancelled) {
            html += `
                <div class="remedies-section">
                    <h4>⚕ Recommended Remedies for Mangal Dosha</h4>
                    <ul class="remedies-list">
                        <li><span class="remedy-icon">🕉</span> <strong>Mangal Shanti Puja:</strong> Perform Mars pacification rituals at a temple</li>
                        <li><span class="remedy-icon">💎</span> <strong>Red Coral (Moonga):</strong> Wear on ring finger after proper consultation</li>
                        <li><span class="remedy-icon">🙏</span> <strong>Hanuman Chalisa:</strong> Recite daily, especially on Tuesdays</li>
                        <li><span class="remedy-icon">🌿</span> <strong>Tuesday Fasting:</strong> Observe fast on Tuesdays and donate red items</li>
                        <li><span class="remedy-icon">💒</span> <strong>Kumbh Vivah:</strong> Symbolic marriage to a banana tree, Peepal tree, or silver/gold idol</li>
                        <li><span class="remedy-icon">❤️</span> <strong>Marry a Manglik:</strong> When both partners are Manglik, the dosha is cancelled</li>
                        <li><span class="remedy-icon">📿</span> <strong>Mangal Mantra:</strong> Chant "Om Kraam Kreem Kroum Sah Bhaumaya Namah" 108 times</li>
                    </ul>
                    <p style="margin-top: 15px; font-size: 0.9rem; opacity: 0.8;">
                        <strong>Note:</strong> Please consult a qualified Vedic astrologer for personalized remedies based on your complete birth chart.
                    </p>
                </div>
            `;
        }
        
        // Cancellation info if applicable
        if (result.cancellationReasons.length > 0) {
            html += `
                <div class="cancellation-info">
                    <h5>✨ Dosha Mitigation Factors Found</h5>
                    <ul style="margin-left: 20px; margin-top: 10px;">
                        ${result.cancellationReasons.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove('hidden');
        
        // Scroll to results
        setTimeout(() => {
            resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // Event listener for calculate button
    document.addEventListener('DOMContentLoaded', function() {
        const calculateBtn = document.getElementById('calculate-mangal');
        
        if (calculateBtn) {
            calculateBtn.addEventListener('click', function() {
                // Get form values
                const dateStr = document.getElementById('birth-date').value;
                const timeStr = document.getElementById('birth-time').value;
                const latitude = parseFloat(document.getElementById('birth-lat').value);
                const longitude = parseFloat(document.getElementById('birth-lng').value);
                const timezone = parseFloat(document.getElementById('timezone').value);
                const birthPlace = document.getElementById('birth-place').value;
                
                // Validation
                if (!dateStr || !timeStr || isNaN(latitude) || isNaN(longitude) || isNaN(timezone)) {
                    alert('⚠ Please fill in all required fields (Date, Time, Latitude, Longitude, Timezone)');
                    return;
                }
                
                // Calculate
                try {
                    const result = calculateMangalDosha(dateStr, timeStr, latitude, longitude, timezone);
                    displayResults(result, birthPlace);
                } catch (error) {
                    console.error('Calculation error:', error);
                    alert('⚠ Error in calculation. Please check your inputs and try again.');
                }
            });
        }
    });

    // Export for external use
    window.MangalCalculator = {
        calculate: calculateMangalDosha
    };

})();
