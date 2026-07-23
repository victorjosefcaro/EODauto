// ==UserScript==
// @name         EODAuto Forms Filler
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Auto-fills Microsoft Forms for EODAuto (Multi-page support)
// @author       Antigravity
// @match        *://forms.office.com/Pages/ResponsePage.aspx*
// @match        *://forms.cloud.microsoft/pages/responsepage.aspx*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Check if URL has our hash
    if (!window.location.hash.includes('eodauto=')) {
        return;
    }

    // Parse the data
    const hashData = window.location.hash.split('eodauto=')[1];
    let data;
    try {
        data = JSON.parse(decodeURIComponent(hashData));
    } catch (e) {
        console.error('EODAuto: Failed to parse hash data', e);
        return;
    }

    console.log('EODAuto: Found data to auto-fill', data);

    const interval = 500;
    let currentPage = 1;
    let currentQuestionsNode = null;

    const fillForm = setInterval(() => {
        const questions = document.querySelectorAll('div[data-automation-id="questionItem"]');
        if (questions.length === 0) return; // Wait for load

        // Wait until the DOM has actually transitioned to the next page
        if (questions[0] === currentQuestionsNode) return;

        // Helper to fill text inputs (React needs simulated events)
        const fillText = (element, value) => {
            if (!element || value == null || value === '') return;
            let setter = (element.tagName === 'TEXTAREA') ?
                Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set :
                Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

            if (setter) {
                setter.call(element, value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        const clickNext = () => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const nextBtn = document.querySelector('button[data-automation-id="nextButton"]') ||
                buttons.find(b => b.innerText.trim().toLowerCase() === 'next');

            if (nextBtn) {
                currentQuestionsNode = questions[0]; // Save reference to old DOM node
                setTimeout(() => nextBtn.click(), 300);
            }
        };

        try {
            if (currentPage === 1) {
                console.log('EODAuto: Filling Page 1...');
                // Q1: Employee ID
                if (questions[0]) fillText(questions[0].querySelector('input, textarea'), data.empId);

                // Q2: Attendance Status (Radio)
                if (questions[1]) {
                    const radios = questions[1].querySelectorAll('input[type="radio"]');
                    radios.forEach(radio => {
                        const label = radio.closest('label');
                        if (label && label.innerText.toUpperCase().includes(data.attendanceStatus.toUpperCase())) {
                            radio.click();
                        }
                    });
                }

                // Q3: Date Today
                if (questions[2]) fillText(questions[2].querySelector('input'), data.date);

                currentPage = 2;
                clickNext();
            }
            else if (currentPage === 2) {
                console.log('EODAuto: Filling Page 2...');
                // Q4: Text generated
                if (questions[0]) fillText(questions[0].querySelector('textarea, input'), data.report);

                // Q5: Optional (skip)

                currentPage = 3;
                clickNext();
            }
            else if (currentPage === 3) {
                console.log('EODAuto: Filling Page 3...');

                const clickRating = (qIndex, ratingVal) => {
                    if (!questions[qIndex]) return;
                    const stars = questions[qIndex].querySelectorAll('span[role="radio"], div[role="radio"], i[role="radio"]');
                    if (stars.length >= parseInt(ratingVal)) {
                        stars[parseInt(ratingVal) - 1].click();
                    }
                };

                // Q6: 5 star rating
                clickRating(0, data.starRating6);
                // Q7: 5 star rating
                clickRating(1, data.starRating7);

                currentPage = 4;
                clickNext();
            }
            else if (currentPage === 4) {
                console.log('EODAuto: Filling Page 4...');
                // Q8: Default Text
                if (questions[0]) fillText(questions[0].querySelector('textarea, input'), data.defaultText8);
                // Q9: Default Text (Optional)
                if (questions[1]) fillText(questions[1].querySelector('textarea, input'), data.defaultText9);

                console.log('EODAuto: Successfully filled form!');

                // Clean up hash so it doesn't re-trigger on manual reload
                history.replaceState(null, null, ' ');
                clearInterval(fillForm);
            }
        } catch (e) {
            console.error('EODAuto: Error filling form', e);
            clearInterval(fillForm);
        }

    }, interval);

})();
