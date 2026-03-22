/**
 * Celestial Match - Application Logic v2.0
 * Enhanced with Rashi-Nakshatra filtering and detailed explanations
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeDropdowns();
    setupEventListeners();
    addGradientDef();
    setupActionButtons();
    setupInfoAccordion();
});

// English zodiac names for Rashis
const RASHI_ENGLISH = {
    'Mesha': 'Aries', 'Vrishaba': 'Taurus', 'Mithuna': 'Gemini', 'Karka': 'Cancer',
    'Simha': 'Leo', 'Kanya': 'Virgo', 'Tula': 'Libra', 'Vrischika': 'Scorpio',
    'Dhanu': 'Sagittarius', 'Makara': 'Capricorn', 'Kumbha': 'Aquarius', 'Meena': 'Pisces'
};

// Koota descriptions with significance
const KOOTA_INFO = {
    dina: {
        name: 'Dina Koota',
        hindi: 'दिन कूट',
        icon: '☀️',
        maxPoints: 3,
        significance: 'Daily Harmony & Health',
        description: 'Dina Koota assesses the day-to-day compatibility between the couple. It indicates how well they will get along in their daily routines, their general health compatibility, and mutual well-being. A good Dina score suggests the couple will have fewer daily conflicts and enjoy better health together.',
        calculation: 'Calculated by counting nakshatras from girl to boy and dividing by 9. Favorable remainders indicate compatibility.'
    },
    gana: {
        name: 'Gana Koota',
        hindi: 'गण कूट',
        icon: '👥',
        maxPoints: 4,
        significance: 'Temperament & Nature',
        description: 'Gana Koota evaluates the basic temperament and nature of both individuals. There are three Ganas: Deva (divine/sattvic - gentle, cultured), Nara (human/rajasic - mixed nature), and Rakshasa (demon/tamasic - dominating, aggressive). Matching Ganas ensures psychological compatibility and similar value systems.',
        calculation: 'Based on the Gana classification of nakshatras. Same Gana = 4 points, Adjacent = 2 points, Opposite = 0 points.'
    },
    yoni: {
        name: 'Yoni Koota',
        hindi: 'योनि कूट',
        icon: '🦁',
        maxPoints: 4,
        significance: 'Physical & Intimate Compatibility',
        description: 'Yoni Koota determines physical and sexual compatibility between partners. Each nakshatra is associated with an animal symbol representing physical characteristics and intimate behavior. Matching Yonis ensures physical harmony and compatibility in married life.',
        calculation: 'Based on animal symbols of nakshatras. Same animal with natural sexes = 4 points. Enemy animals = 0 points.'
    },
    rasi: {
        name: 'Rasi Koota',
        hindi: 'राशि कूट',
        icon: '♈',
        maxPoints: 7,
        significance: 'Emotional & Mental Compatibility',
        description: 'Rasi Koota is one of the most important factors, evaluating emotional and mental compatibility based on Moon signs. The position of Moon signs relative to each other determines harmony in thoughts, emotions, and general understanding between partners. This koota carries the highest points.',
        calculation: 'Based on the position of Rashis from each other. 1st, 5th, 7th, 9th positions are favorable. 2nd, 6th, 8th, 12th need exceptions.'
    },
    rasiadhipati: {
        name: 'Rasyadhipati Koota',
        hindi: 'राश्यधिपति कूट',
        icon: '👑',
        maxPoints: 5,
        significance: 'Planetary Lord Harmony',
        description: 'Rasyadhipati examines the relationship between the ruling planets (lords) of the Moon signs of both partners. Friendly planetary lords indicate natural harmony, while enemy lords may cause friction. This affects long-term compatibility and mutual growth.',
        calculation: 'Based on the friendship/enmity between Rashi lords. Both friends = 5, One friend = 4, Neutral = 3, Enemy = 0-1.'
    },
    rajju: {
        name: 'Rajju Koota',
        hindi: 'रज्जु कूट',
        icon: '🔗',
        maxPoints: 5,
        significance: 'Longevity & Well-being',
        description: 'Rajju Koota is crucial for determining the longevity and well-being of the marriage and spouse. Rajju means "rope" - nakshatras are classified into 5 body parts (Paada/foot, Vooru/thigh, Udara/stomach, Kantha/neck, Sira/head). Same Rajju may indicate health issues for that body part or widowhood.',
        calculation: 'Different Rajju positions = 5 points (safe). Same Rajju = 0 points (caution advised).'
    },
    vedha: {
        name: 'Vedha Koota',
        hindi: 'वेध कूट',
        icon: '⚡',
        maxPoints: 2,
        significance: 'Affliction & Obstacles',
        description: 'Vedha means "affliction" or "piercing". Certain nakshatra pairs are believed to cause obstacles, sorrows, and problems in married life. Vedha dosha is considered serious and its presence is a significant negative factor in compatibility assessment.',
        calculation: 'Specific nakshatra pairs cause Vedha. No Vedha = 2 points. Vedha present = 0 points.'
    },
    vasya: {
        name: 'Vasya Koota',
        hindi: 'वश्य कूट',
        icon: '🤝',
        maxPoints: 2,
        significance: 'Mutual Attraction & Influence',
        description: 'Vasya indicates the degree of magnetic attraction and influence between partners. It determines who will have more control or influence in the relationship and how agreeable the partners will be to each other. Good Vasya ensures mutual respect and attraction.',
        calculation: 'Based on the Vasya relationship between Rashis. Mutual attraction = 2 points. No Vasya = 0 points.'
    },
    mahendra: {
        name: 'Mahendra Koota',
        hindi: 'महेंद्र कूट',
        icon: '🏛️',
        maxPoints: 2,
        significance: 'Prosperity & Progeny',
        description: 'Mahendra Koota ensures the well-being of the family, prosperity in household affairs, and good progeny. It indicates the couple\'s ability to grow their family and wealth together. Favorable Mahendra promotes family happiness and continuity of lineage.',
        calculation: 'Girl\'s nakshatra should be in favorable positions (4th, 7th, 10th, 13th, 16th, 19th, 22nd, 25th) from boy\'s nakshatra.'
    },
    streedeergha: {
        name: 'Stree Deergha',
        hindi: 'स्त्री दीर्घ',
        icon: '📏',
        maxPoints: 2,
        significance: 'Woman\'s Fortune & Longevity',
        description: 'Stree Deergha specifically looks at the welfare and longevity of the bride. It ensures the woman\'s well-being, prosperity, and happiness after marriage. A favorable score indicates the wife will lead a comfortable and respected life.',
        calculation: 'Girl\'s nakshatra should be at least 9 positions ahead of boy\'s nakshatra for full points.'
    }
};

/**
 * Initialize dropdown menus
 */
function initializeDropdowns() {
    const CE = window.CosmicEngine;
    
    // Populate Rashi dropdowns
    ['bride', 'groom'].forEach(person => {
        const rashiSelect = document.getElementById(`${person}-rasi`);
        CE.rashi.forEach((rashi, index) => {
            const option = document.createElement('option');
            option.value = index + 1;
            option.textContent = `${CE.symbols[index]} ${rashi} (${RASHI_ENGLISH[rashi]})`;
            rashiSelect.appendChild(option);
        });
    });
    
    // Initially populate all nakshatras (will be filtered on rashi selection)
    ['bride', 'groom'].forEach(person => {
        populateNakshatras(person, null);
    });
}

/**
 * Populate Nakshatra dropdown based on selected Rashi
 */
function populateNakshatras(person, rashiNum) {
    const CE = window.CosmicEngine;
    const nakshatraSelect = document.getElementById(`${person}-nakshatra`);
    const currentValue = nakshatraSelect.value;
    
    // Clear existing options
    nakshatraSelect.innerHTML = '<option value="">Select Nakshatra...</option>';
    
    let nakshatrasToShow;
    if (rashiNum) {
        // Get only nakshatras for this rashi
        nakshatrasToShow = CE.getNakshatrasForRashi(parseInt(rashiNum));
    } else {
        // Show all nakshatras
        nakshatrasToShow = Array.from({length: 27}, (_, i) => i + 1);
    }
    
    nakshatrasToShow.forEach(nNum => {
        const option = document.createElement('option');
        option.value = nNum;
        option.textContent = `${nNum}. ${CE.nakshatra[nNum - 1]}`;
        nakshatraSelect.appendChild(option);
    });
    
    // Restore selection if still valid
    if (currentValue && nakshatrasToShow.includes(parseInt(currentValue))) {
        nakshatraSelect.value = currentValue;
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    const CE = window.CosmicEngine;
    
    // Rashi selection changes
    ['bride', 'groom'].forEach(person => {
        document.getElementById(`${person}-rasi`).addEventListener('change', function() {
            const rashiNum = this.value;
            if (rashiNum) {
                populateNakshatras(person, rashiNum);
            } else {
                populateNakshatras(person, null);
            }
            updateInfo(person);
        });
        
        document.getElementById(`${person}-nakshatra`).addEventListener('change', function() {
            updateInfo(person);
        });
    });
    
    // Calculate button
    document.getElementById('calculate-btn').addEventListener('click', calculateCompatibility);
}

/**
 * Update info display for person
 */
function updateInfo(person) {
    const CE = window.CosmicEngine;
    const rashiSelect = document.getElementById(`${person}-rasi`);
    const nakshatraSelect = document.getElementById(`${person}-nakshatra`);
    const infoDiv = document.getElementById(`${person}-info`);
    
    const rashiNum = parseInt(rashiSelect.value);
    const nakshatraNum = parseInt(nakshatraSelect.value);
    
    if (rashiNum && nakshatraNum) {
        const rashi = CE.rashi[rashiNum - 1];
        const nakshatra = CE.nakshatra[nakshatraNum - 1];
        const gana = CE.getGana(nakshatraNum);
        const yoni = CE.getYoni(nakshatraNum);
        const rajju = CE.getRajju(nakshatraNum);
        const lord = CE.getLord(rashiNum);
        
        infoDiv.innerHTML = `
            <div style="text-align: left; width: 100%; font-size: 0.85rem;">
                <div>🌙 <strong>${rashi}</strong> (${RASHI_ENGLISH[rashi]})</div>
                <div>⭐ <strong>${nakshatra}</strong></div>
                <div>👤 Gana: <strong>${gana}</strong></div>
                <div>🦁 Yoni: <strong>${yoni.animal}</strong> (${yoni.sex === 'M' ? 'Male' : 'Female'})</div>
                <div>🔗 Rajju: <strong>${rajju}</strong></div>
                <div>👑 Lord: <strong>${CE.getLordName(lord)}</strong></div>
            </div>
        `;
    } else if (rashiNum) {
        const rashi = CE.rashi[rashiNum - 1];
        infoDiv.innerHTML = `<div>🌙 ${CE.symbols[rashiNum - 1]} ${rashi} selected<br><small>Please select Nakshatra</small></div>`;
    } else {
        infoDiv.innerHTML = '<div style="opacity: 0.6;">Select Rashi and Nakshatra</div>';
    }
}

/**
 * Calculate compatibility and display results
 */
function calculateCompatibility() {
    const CE = window.CosmicEngine;
    
    const brideRashi = parseInt(document.getElementById('bride-rasi').value);
    const brideNakshatra = parseInt(document.getElementById('bride-nakshatra').value);
    const groomRashi = parseInt(document.getElementById('groom-rasi').value);
    const groomNakshatra = parseInt(document.getElementById('groom-nakshatra').value);
    
    // Validation
    if (!brideRashi || !brideNakshatra || !groomRashi || !groomNakshatra) {
        alert('✨ Please select Rashi and Nakshatra for both Bride and Groom to reveal your cosmic compatibility! ✨');
        return;
    }
    
    // Compute compatibility
    const results = CE.compute(brideRashi, brideNakshatra, groomRashi, groomNakshatra);
    
    // Show results section
    const resultsSection = document.getElementById('results');
    resultsSection.classList.remove('hidden');
    
    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    // Animate score
    animateScore(results.total, results.verdict);
    
    // Update individual koota scores
    updateKootaScores(results);
    
    // Generate interpretation
    generateInterpretation(results, brideRashi, brideNakshatra, groomRashi, groomNakshatra);
}

/**
 * Animate the score circle
 */
function animateScore(score, verdict) {
    const scoreEl = document.getElementById('total-score');
    const circleEl = document.getElementById('score-circle');
    const verdictEl = document.getElementById('compatibility-verdict');
    
    // Reset first
    scoreEl.textContent = '0';
    circleEl.style.strokeDashoffset = 283;
    
    // Animate number
    let currentScore = 0;
    const increment = score / 50;
    const timer = setInterval(() => {
        currentScore += increment;
        if (currentScore >= score) {
            currentScore = score;
            clearInterval(timer);
        }
        scoreEl.textContent = Math.round(currentScore);
    }, 30);
    
    // Animate circle
    const circumference = 283;
    const offset = circumference - (score / 36) * circumference;
    
    // Set stroke color based on verdict
    let strokeColor;
    switch(verdict) {
        case 'Excellent': strokeColor = '#4ade80'; break;
        case 'Very Good': strokeColor = '#86efac'; break;
        case 'Good': strokeColor = '#4cc9f0'; break;
        case 'Moderate': strokeColor = '#fb923c'; break;
        default: strokeColor = '#f87171';
    }
    circleEl.style.stroke = strokeColor;
    
    setTimeout(() => {
        circleEl.style.strokeDashoffset = offset;
    }, 100);
    
    // Update verdict
    const verdictTexts = {
        'Excellent': '🌟 Excellent Match! 🌟',
        'Very Good': '✨ Very Good Match! ✨',
        'Good': '💫 Good Match 💫',
        'Moderate': '🔮 Moderate Match 🔮',
        'Bad': '⚠️ Needs Consideration ⚠️'
    };
    verdictEl.textContent = verdictTexts[verdict] || verdict;
    verdictEl.className = 'verdict ' + verdict.toLowerCase().replace(' ', '-');
}

/**
 * Update individual koota scores with detailed tooltips
 */
function updateKootaScores(results) {
    const kootas = ['dina', 'gana', 'yoni', 'rasi', 'rasiadhipati', 'rajju', 'vedha', 'vasya', 'mahendra', 'streedeergha'];
    
    kootas.forEach((koota, index) => {
        const scoreEl = document.getElementById(`${koota}-score`);
        const barEl = document.getElementById(`${koota}-bar`);
        
        if (scoreEl && barEl) {
            const score = results[koota];
            const max = results.max[koota];
            
            setTimeout(() => {
                scoreEl.textContent = score;
                barEl.style.width = `${(score / max) * 100}%`;
                
                // Color the bar based on score percentage
                const percentage = (score / max) * 100;
                if (percentage >= 75) {
                    barEl.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
                } else if (percentage >= 50) {
                    barEl.style.background = 'linear-gradient(90deg, #4cc9f0, #0ea5e9)';
                } else if (percentage >= 25) {
                    barEl.style.background = 'linear-gradient(90deg, #fb923c, #f97316)';
                } else {
                    barEl.style.background = 'linear-gradient(90deg, #f87171, #ef4444)';
                }
            }, index * 100);
        }
    });
}

/**
 * Generate detailed interpretation with comprehensive explanations
 */
function generateInterpretation(results, brideRashi, brideNakshatra, groomRashi, groomNakshatra) {
    const CE = window.CosmicEngine;
    const interpretationEl = document.getElementById('interpretation-text');
    
    const brideRashiName = CE.rashi[brideRashi - 1];
    const groomRashiName = CE.rashi[groomRashi - 1];
    const brideNakshatraName = CE.nakshatra[brideNakshatra - 1];
    const groomNakshatraName = CE.nakshatra[groomNakshatra - 1];
    
    let html = `
        <p style="font-size: 1.1rem; margin-bottom: 20px;">
            <span class="highlight">📊 Match Summary:</span><br>
            <strong>Bride:</strong> ${brideNakshatraName} nakshatra in ${brideRashiName} (${RASHI_ENGLISH[brideRashiName]}) rashi<br>
            <strong>Groom:</strong> ${groomNakshatraName} nakshatra in ${groomRashiName} (${RASHI_ENGLISH[groomRashiName]}) rashi<br>
            <strong>Total Score:</strong> ${results.total}/36 points (${results.percentage.toFixed(1)}%)
        </p>
        
        <h4 style="color: var(--star-gold); margin: 25px 0 15px;">📜 Detailed Koota Analysis</h4>
    `;
    
    // Add detailed analysis for each Koota
    const kootas = ['dina', 'gana', 'yoni', 'rasi', 'rasiadhipati', 'rajju', 'vedha', 'vasya', 'mahendra', 'streedeergha'];
    
    kootas.forEach(koota => {
        const info = KOOTA_INFO[koota];
        const score = results[koota];
        const max = results.max[koota];
        const percentage = (score / max) * 100;
        
        let statusClass, statusText;
        if (percentage >= 75) {
            statusClass = 'color: #4ade80';
            statusText = '✓ Favorable';
        } else if (percentage >= 50) {
            statusClass = 'color: #4cc9f0';
            statusText = '○ Moderate';
        } else if (percentage > 0) {
            statusClass = 'color: #fb923c';
            statusText = '△ Partial';
        } else {
            statusClass = 'color: #f87171';
            statusText = '✗ Unfavorable';
        }
        
        html += `
            <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 4px solid ${percentage >= 50 ? '#4ade80' : '#fb923c'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="font-size: 1.1rem;">${info.icon} ${info.name} (${info.hindi})</strong>
                    <span style="${statusClass}; font-weight: bold;">${score}/${max} - ${statusText}</span>
                </div>
                <p style="margin-bottom: 8px; opacity: 0.9;"><em>Significance: ${info.significance}</em></p>
                <p style="margin-bottom: 8px; line-height: 1.6;">${info.description}</p>
                <p style="font-size: 0.9rem; opacity: 0.7;"><strong>How it's calculated:</strong> ${info.calculation}</p>
                ${getKootaSpecificInterpretation(koota, score, brideNakshatra, groomNakshatra, brideRashi, groomRashi)}
            </div>
        `;
    });
    
    // Final recommendation
    html += `
        <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 107, 157, 0.1)); border-radius: 15px; border: 1px solid rgba(255, 215, 0, 0.3);">
            <h4 style="color: var(--star-gold); margin-bottom: 15px;">🌟 Final Recommendation</h4>
            <p style="line-height: 1.8; font-size: 1.05rem;">${getRecommendation(results.verdict, results.total, results)}</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background: rgba(76, 201, 240, 0.1); border-radius: 10px; font-size: 0.9rem;">
            <strong>📌 Note:</strong> Kundli matching is one of many factors in marriage compatibility. 
            A lower score doesn't mean incompatibility - it suggests areas that may need more understanding and effort. 
            Many successful marriages have moderate scores. Love, respect, and commitment are equally important!
        </div>
    `;
    
    interpretationEl.innerHTML = html;
}

/**
 * Get specific interpretation for each Koota
 */
function getKootaSpecificInterpretation(koota, score, brideN, groomN, brideR, groomR) {
    const CE = window.CosmicEngine;
    
    switch(koota) {
        case 'dina':
            if (score === 3) return '<p style="color: #4ade80; margin-top: 8px;">✓ Your daily rhythms are in harmony. Expect smooth day-to-day interactions and mutual understanding in daily routines.</p>';
            return '<p style="color: #fb923c; margin-top: 8px;">△ Daily routine compatibility may need conscious effort. Practice patience in everyday matters.</p>';
            
        case 'gana':
            const brideGana = CE.getGana(brideN);
            const groomGana = CE.getGana(groomN);
            return `<p style="margin-top: 8px;"><strong>Bride's Gana:</strong> ${brideGana} | <strong>Groom's Gana:</strong> ${groomGana}<br>
                ${score === 4 ? '<span style="color: #4ade80;">✓ Perfect temperament match!</span>' : 
                  score === 2 ? '<span style="color: #4cc9f0;">○ Compatible with some differences in nature.</span>' : 
                  '<span style="color: #fb923c;">△ Different temperaments - understanding and adjustment needed.</span>'}</p>`;
            
        case 'yoni':
            const brideYoni = CE.getYoni(brideN);
            const groomYoni = CE.getYoni(groomN);
            return `<p style="margin-top: 8px;"><strong>Bride's Yoni:</strong> ${brideYoni.animal} (${brideYoni.sex === 'M' ? 'Male' : 'Female'}) | 
                <strong>Groom's Yoni:</strong> ${groomYoni.animal} (${groomYoni.sex === 'M' ? 'Male' : 'Female'})<br>
                ${score >= 3 ? '<span style="color: #4ade80;">✓ Good physical compatibility indicated.</span>' : 
                  score >= 1 ? '<span style="color: #4cc9f0;">○ Acceptable physical compatibility.</span>' : 
                  '<span style="color: #fb923c;">△ Physical harmony may require understanding and patience.</span>'}</p>`;
            
        case 'rajju':
            const brideRajju = CE.getRajju(brideN);
            const groomRajju = CE.getRajju(groomN);
            return `<p style="margin-top: 8px;"><strong>Bride's Rajju:</strong> ${brideRajju} | <strong>Groom's Rajju:</strong> ${groomRajju}<br>
                ${score === 5 ? '<span style="color: #4ade80;">✓ Different Rajju positions - auspicious for longevity!</span>' : 
                  '<span style="color: #f87171;">⚠ Same Rajju - traditional remedies recommended. Consult an astrologer for specific guidance.</span>'}</p>`;
            
        case 'vedha':
            return score === 2 ? 
                '<p style="color: #4ade80; margin-top: 8px;">✓ No Vedha dosha - the nakshatras do not afflict each other.</p>' :
                '<p style="color: #f87171; margin-top: 8px;">⚠ Vedha dosha present - this nakshatra combination may face some challenges. Specific remedial measures are recommended.</p>';
            
        default:
            return '';
    }
}

/**
 * Get final recommendation based on results
 */
function getRecommendation(verdict, score, results) {
    let text = '';
    
    // Opening based on overall verdict
    switch(verdict) {
        case 'Excellent':
            text = `With a score of ${score}/36 (${((score/36)*100).toFixed(0)}%), this is a highly auspicious match!`;
            break;
        case 'Very Good':
            text = `With a score of ${score}/36 (${((score/36)*100).toFixed(0)}%), this is a very favorable match.`;
            break;
        case 'Good':
            text = `With a score of ${score}/36 (${((score/36)*100).toFixed(0)}%), this is a good match.`;
            break;
        case 'Moderate':
            text = `With a score of ${score}/36 (${((score/36)*100).toFixed(0)}%), this match shows moderate compatibility.`;
            break;
        default:
            text = `With a score of ${score}/36 (${((score/36)*100).toFixed(0)}%), careful consideration is advised.`;
    }

    // Strengths section
    const strengths = [];
    if (results.rasi === 7) strengths.push('excellent emotional/mental compatibility (Rasi 7/7)');
    else if (results.rasi >= 5) strengths.push('good emotional compatibility (Rasi ' + results.rasi + '/7)');
    if (results.rasiadhipati === 5) strengths.push('planetary lords are very harmonious (Rasyadhipati 5/5)');
    else if (results.rasiadhipati >= 4) strengths.push('favorable planetary lord relationship');
    if (results.rajju === 5) strengths.push('different Rajju ensures marital longevity');
    if (results.vedha === 2) strengths.push('no nakshatra affliction (Vedha free)');
    if (results.gana === 4) strengths.push('same temperament (Gana 4/4)');
    else if (results.gana === 2) strengths.push('compatible temperaments');
    if (results.dina === 3) strengths.push('good daily harmony');
    if (results.yoni >= 3) strengths.push('good physical compatibility');
    if (results.vasya === 2) strengths.push('mutual attraction (Vasya 2/2)');
    if (results.mahendra === 2) strengths.push('favorable for prosperity and progeny');
    if (results.streedeergha === 2) strengths.push('auspicious for bride\'s welfare');

    if (strengths.length > 0) {
        text += `<br><br><strong>✓ Strengths:</strong> ${strengths.join(', ')}.`;
    }

    // Areas of concern
    const concerns = [];
    if (results.rasi === 0) concerns.push('challenging rashi position (may need extra effort in emotional understanding)');
    if (results.rasiadhipati <= 1) concerns.push('planetary lords are not naturally harmonious');
    if (results.rajju === 0) concerns.push('same Rajju body part (traditional caution advised)');
    if (results.vedha === 0) concerns.push('Vedha dosha present between nakshatras');
    if (results.gana === 0) concerns.push('different temperaments (Deva-Rakshasa)');
    if (results.dina === 0) concerns.push('daily routine compatibility needs attention');
    if (results.yoni === 0) concerns.push('yoni compatibility challenge');
    if (results.vasya === 0) concerns.push('no natural vasya attraction');
    if (results.mahendra === 0) concerns.push('Mahendra not favorable');
    if (results.streedeergha === 0) concerns.push('Stree Deergha needs consideration');

    if (concerns.length > 0) {
        text += `<br><br><strong>△ Areas to consider:</strong> ${concerns.join(', ')}.`;
    }

    // Specific doshas that need remedies
    const doshas = [];
    if (results.rajju === 0) doshas.push('Rajju Dosha');
    if (results.vedha === 0) doshas.push('Vedha Dosha');
    if (results.gana === 0) doshas.push('Gana Dosha');

    if (doshas.length > 0) {
        text += `<br><br><strong>⚠ Doshas detected:</strong> ${doshas.join(', ')}. It is recommended to consult a qualified Vedic astrologer for specific remedial measures (parihara) such as puja, mantra, or gemstone recommendations.`;
    }

    // Final advice based on score
    text += '<br><br>';
    if (score >= 26) {
        text += '<strong>Overall:</strong> The stars strongly favor this union. Proceed with confidence!';
    } else if (score >= 21) {
        text += '<strong>Overall:</strong> This is a compatible match. Minor challenges can be addressed with mutual understanding.';
    } else if (score >= 18) {
        text += '<strong>Overall:</strong> This match has both positive aspects and areas needing attention. With conscious effort from both partners, this can be a successful union.';
    } else {
        text += '<strong>Overall:</strong> This match requires careful consideration. It\'s advisable to perform additional matching methods and consult an experienced astrologer before proceeding.';
    }

    return text;
}

/**
 * Add SVG gradient definition for score circle
 */
function addGradientDef() {
    const svg = document.querySelector('.score-circle svg');
    if (svg) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ff6b9d"/>
                <stop offset="50%" style="stop-color:#ffd700"/>
                <stop offset="100%" style="stop-color:#4cc9f0"/>
            </linearGradient>
        `;
        svg.insertBefore(defs, svg.firstChild);
    }
}

/**
 * Setup info accordion toggle
 */
function setupInfoAccordion() {
    const toggle = document.getElementById('info-toggle');
    const content = document.getElementById('info-content');
    
    if (toggle && content) {
        toggle.addEventListener('click', function() {
            toggle.classList.toggle('active');
            content.classList.toggle('expanded');
        });
    }
}

/**
 * Setup action buttons (Print & Reset)
 */
function setupActionButtons() {
    const printBtn = document.getElementById('print-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    if (printBtn) {
        printBtn.addEventListener('click', printReport);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetCalculation);
    }
}

/**
 * Print the compatibility report
 */
function printReport() {
    const CE = window.CosmicEngine;
    
    // Get current selections
    const brideRashi = parseInt(document.getElementById('bride-rasi').value);
    const brideNakshatra = parseInt(document.getElementById('bride-nakshatra').value);
    const groomRashi = parseInt(document.getElementById('groom-rasi').value);
    const groomNakshatra = parseInt(document.getElementById('groom-nakshatra').value);
    
    // Create print header with couple details
    const brideRashiName = CE.rashi[brideRashi - 1];
    const groomRashiName = CE.rashi[groomRashi - 1];
    const brideNakshatraName = CE.nakshatra[brideNakshatra - 1];
    const groomNakshatraName = CE.nakshatra[groomNakshatra - 1];
    
    // Add a temporary print info section
    const resultsSection = document.getElementById('results');
    const printInfo = document.createElement('div');
    printInfo.id = 'print-info-temp';
    printInfo.className = 'print-header-info';
    printInfo.innerHTML = `
        <div style="text-align: center; padding: 20px; background: #f8f8f8; border-radius: 10px; margin-bottom: 20px; display: none;">
            <h2 style="margin-bottom: 15px; color: #333;">Dasa Koota Gun Milan Report</h2>
            <p style="margin-bottom: 10px;"><strong>Bride:</strong> ${brideNakshatraName} nakshatra in ${brideRashiName} (${RASHI_ENGLISH[brideRashiName]})</p>
            <p style="margin-bottom: 10px;"><strong>Groom:</strong> ${groomNakshatraName} nakshatra in ${groomRashiName} (${RASHI_ENGLISH[groomRashiName]})</p>
            <p style="font-size: 0.9em; color: #666;">Generated on: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
    `;
    
    // Insert before results header
    const resultsHeader = resultsSection.querySelector('.results-header');
    resultsSection.insertBefore(printInfo, resultsHeader);
    
    // Trigger print
    window.print();
    
    // Remove temporary element after print dialog
    setTimeout(() => {
        const tempEl = document.getElementById('print-info-temp');
        if (tempEl) tempEl.remove();
    }, 500);
}

/**
 * Reset all selections and hide results
 */
function resetCalculation() {
    // Reset dropdowns
    document.getElementById('bride-rasi').value = '';
    document.getElementById('bride-nakshatra').value = '';
    document.getElementById('groom-rasi').value = '';
    document.getElementById('groom-nakshatra').value = '';
    
    // Reset nakshatra dropdowns to show all
    populateNakshatras('bride', null);
    populateNakshatras('groom', null);
    
    // Reset info displays
    document.getElementById('bride-info').innerHTML = '<div style="opacity: 0.6;">Select Rashi and Nakshatra</div>';
    document.getElementById('groom-info').innerHTML = '<div style="opacity: 0.6;">Select Rashi and Nakshatra</div>';
    
    // Hide results section
    const resultsSection = document.getElementById('results');
    resultsSection.classList.add('hidden');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
