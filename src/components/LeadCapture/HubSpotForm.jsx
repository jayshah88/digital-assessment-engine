import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * HubSpot Form Component
 * Embeds a HubSpot form with assessment data pre-populated as hidden fields
 */
export default function HubSpotForm({
  portalId,
  formId,
  region = 'na1',
  answers,
  allQuestions,
  result,
  onSubmitting,
  onFormSubmitted
}) {
  const containerRef = useRef(null);
  const formInitializedRef = useRef(false);
  const hasSubmittedRef = useRef(false);

  // Prepare assessment data for HubSpot hidden fields
  const getAssessmentData = () => {
    // Format answers as key-value pairs for hidden fields
    const answerData = {};
    let totalPoints = 0;

    if (answers && allQuestions) {
      allQuestions.forEach((question, index) => {
        const num = String(index + 1).padStart(2, '0');
        const answerValue = answers[question.id];

        if (answerValue !== undefined) {
          // Try multiple possible question text properties (database uses question_text)
          const questionText = question.question_text || question.text || question.question || question.label || question.title || `Question ${num}`;

          // Look up answer text and score from options (answerValue is option ID)
          let answerText = answerValue;
          let answerPoints = 0;

          if (question.options && Array.isArray(question.options)) {
            // Convert answerValue to string for comparison (option.id is string in database)
            const answerValueStr = String(answerValue);
            const selectedOption = question.options.find(opt =>
              opt.id === answerValueStr ||
              opt.option_id === answerValueStr ||
              opt.value === answerValueStr
            );
            if (selectedOption) {
              answerText = selectedOption.option_text || selectedOption.text || selectedOption.label || answerValue;
              // Get score_value and convert to number
              const rawPoints = parseFloat(selectedOption.score_value ?? selectedOption.points ?? selectedOption.score ?? 0);
              // Multiply by BLOCK weight (not deprecated question.weight)
              const weight = parseFloat(question.blockWeight || question.block_weight || 1);
              answerPoints = rawPoints * weight;
            }
          }

          totalPoints += answerPoints;

          answerData[`question${num}`] = questionText;
          answerData[`question${num}_ans`] = Array.isArray(answerText) ? answerText.join(', ') : answerText;
          answerData[`question${num}_ans_points`] = answerPoints;
        }
      });
    }

    // Build concatenated strings for fallback
    const allQuestionsText = allQuestions.map((q, i) => `Q${i + 1}: ${q.text || q.question || q.label || q.title || `Question ${i + 1}`}`).join(' | ');
    const allAnswersText = allQuestions.map((q, i) => {
      const ans = answers[q.id];
      return `Q${i + 1}: ${ans !== undefined ? (Array.isArray(ans) ? ans.join(', ') : ans) : 'N/A'}`;
    }).join(' | ');

    // Add score and band data
    return {
      ...answerData,
      all_questions: allQuestionsText,
      all_answers: allAnswersText,
      total_point: totalPoints,
      assessment_score: result?.total_score || result?.score || 0,
      assessment_max: result?.total_max || 48,
      assessment_band: result?.band || 'RED',
      assessment_percentage: result?.percentage || 0,
    };
  };

  const onSubmittingRef = useRef(onSubmitting);
  useEffect(() => {
    onSubmittingRef.current = onSubmitting;
  }, [onSubmitting]);

  const onFormSubmittedRef = useRef(onFormSubmitted);
  useEffect(() => {
    onFormSubmittedRef.current = onFormSubmitted;
  }, [onFormSubmitted]);

  useEffect(() => {
    // Prevent duplicate initialization
    if (formInitializedRef.current || !containerRef.current) return;

    let observerInstance = null;

    // Load HubSpot script
    const script = document.createElement('script');
    script.src = `//js-${region}.hsforms.net/forms/embed/v2.js`;
    script.charset = 'utf-8';
    script.async = true;
    script.onload = () => {
      if (window.hbspt && !formInitializedRef.current) {
        formInitializedRef.current = true;

        const assessmentData = getAssessmentData();
        let capturedLeadData = null; // Container for values extracted BEFORE submit

        window.hbspt.forms.create({
          portalId: portalId,
          formId: formId,
          region: region,
          target: `#hubspot-form-${formId}`,
          css: '', // Disable default HubSpot stylesheet inside the iframe
          onFormReady: ($form) => {
            const formEl = $form && ($form[0] || $form);
            const container = document.getElementById(`hubspot-form-${formId}`);
            const iframe = container?.querySelector('iframe');
            const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;

            const docContext = iframeDoc || document;
            const searchRoot = formEl || container || document.body;

            // Inject custom premium styles inside the iframe document
            try {
              if (iframeDoc) {
                const styleEl = iframeDoc.createElement('style');
                styleEl.textContent = `
                  form {
                    // display: grid !important;
                    grid-template-columns: 1fr 1fr !important;
                    gap: 20px !important;
                    text-align: left !important;
                    font-family: inherit !important;
                  }
                  .hs-form-row {
                    display: contents !important;
                  }
                  .hs-form-field {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 8px !important;
                    grid-column: span 1 !important;
                    margin-bottom: 0 !important;
                  }
                  /* Elements that must span full 2 columns */
                  .hs-field-email, .hs-field-gdpr_consent, .hs-field-consent, .hs-field-message,
                  .hs_email, .hs_gdpr_consent, .hs_consent, .hs_message,
                  .hs_submit, .hs-submit {
                    grid-column: span 2 !important;
                  }
                  /* Hide hidden mapping fields to match the PSD form exactly */
                  .hs_total_point, .hs_all_questions, .hs_all_answers, .hs_assessment_score,
                  .hs_assessment_max, .hs_assessment_band, .hs_assessment_percentage,
                  .hs-field-total_point, .hs-field-all_questions, .hs-field-all_answers,
                  .hs-field-assessment_score, .hs-field-assessment_max, .hs-field-assessment_band,
                  .hs-field-assessment_percentage,
                  [class*="hs_question"], [class*="hs-field-question"] {
                    display: none !important;
                  }
                  label {
                    display: block !important;
                    font-size: 13px !important;
                    font-weight: 600 !important;
                    text-transform: none !important;
                    letter-spacing: normal !important;
                    color: #64748b !important;
                    margin-bottom: 8px !important;
                    font-family: inherit !important;
                  }
                  input.hs-input, select.hs-input, textarea.hs-input {
                    width: 100% !important;
                    padding: 16px 20px !important;
                    background: #F8FAFC !important;
                    border: 1.5px solid #F1F5F9 !important;
                    border-radius: 12px !important;
                    font-size: 15px !important;
                    font-weight: 500 !important;
                    color: #020617 !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                    font-family: inherit !important;
                    height: auto !important;
                    transition: all 0.3s ease !important;
                  }
                  input.hs-input:focus, select.hs-input:focus {
                    background: #fff !important;
                    border-color: #2c8c7f !important;
                    box-shadow: 0 4px 12px rgba(44, 140, 127, 0.1) !important;
                  }
                  /* Input Icons inside the iframe */
                  .hs_firstname input, .hs-field-firstname input, input[name="firstname"],
                  .hs_lastname input, .hs-field-lastname input, input[name="lastname"] {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: 16px center !important;
                    background-size: 20px !important;
                    padding-left: 48px !important;
                  }
                  .hs_company input, .hs_company_name input, .hs-field-company input, .hs-field-company_name input, input[name="company"], input[name="company_name"] {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M20.25 14.15v4.25c0 .621-.504 1.125-1.125 1.125H4.875A1.125 1.125 0 0 1 3.75 18.4V14.15m16.5 0c0-1.242-1.008-2.25-2.25-2.25H6c-1.242 0-2.25 1.008-2.25 2.25m16.5 0V9.45c0-1.242-1.008-2.25-2.25-2.25H6c-1.242 0-2.25 1.008-2.25 2.25V14.15M12 5.25L12 3m0 2.25a2.25 2.25 0 0 0 2.25 2.25h1.5a2.25 2.25 0 0 0 2.25-2.25M12 5.25a2.25 2.25 0 0 1-2.25 2.25h-1.5A2.25 2.25 0 0 1 7.5 5.25'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: 16px center !important;
                    background-size: 20px !important;
                    padding-left: 48px !important;
                  }
                  .hs_jobtitle input, .hs_job_title input, .hs-field-jobtitle input, .hs-field-job_title input, input[name="jobtitle"], input[name="job_title"] {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6.429 9.75L2.25 12l4.179 2.25m-4.179 0L12 16.5l9.75-4.5m-9.75 4.5V21m0-16.5L21.75 9l-9.75 4.5M12 4.5L2.25 9m0 0l9.75 4.5'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: 16px center !important;
                    background-size: 20px !important;
                    padding-left: 48px !important;
                  }
                  .hs_email input, .hs-field-email input, input[type="email"], input[name="email"] {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: 16px center !important;
                    background-size: 20px !important;
                    padding-left: 48px !important;
                  }
                  .hs_country select, .hs_country input, .hs-field-country select, .hs-field-country input, select[name="country"], input[name="country"] {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M12.75 3.03v.568c0 .334.148.65.405.864l.406.34c.15.126.372.12.516-.013l.242-.224a1.5 1.5 0 0 1 2.12 0l.08.08c.29.29.35.734.154 1.09l-.213.386a1.5 1.5 0 0 0 .166 1.747l.422.486a1.5 1.5 0 0 1 .166 1.748l-.213.385a1.5 1.5 0 0 0 .154 1.09l.08.08a1.5 1.5 0 0 1 0 2.12l-.224.242a.5.5 0 0 0-.013.516l.34.406c.214.257.53.405.864.405h.568m-17.47-10.27h.568c.334 0 .65.148.864.405l.34.406c.126.15.12.372-.013.516l-.224.242a1.5 1.5 0 0 0 0 2.12l.08.08c.29.29.734.35 1.09.154l.386-.213a1.5 1.5 0 0 1 1.747.166l.486.422a1.5 1.5 0 0 0 1.748.166l.385-.213a1.5 1.5 0 0 1 1.09.154l.08.08a1.5 1.5 0 0 0 2.12 0l.242-.224a.5.5 0 0 1 .516-.013l.406.34c.257.214.405.53.405.864v.568m0 0v5.568c0 .334-.148.65-.405.864l-.406.34a.5.5 0 0 1-.516-.013l-.242-.224a1.5 1.5 0 0 0-2.12 0l-.08.08a1.5 1.5 0 0 1-1.09.154l-.386-.213a1.5 1.5 0 0 0-1.747.166l-.486.422a1.5 1.5 0 0 1-1.748.166l-.385-.213a1.5 1.5 0 0 0-1.09-.154l-.08-.08a1.5 1.5 0 0 1 0-2.12l.224-.242a.5.5 0 0 0 .013-.516l-.34-.406A1.5 1.5 0 0 1 3 16.568V11.25m18 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat, no-repeat !important;
                    background-position: 16px center, calc(100% - 16px) center !important;
                    background-size: 20px, 16px !important;
                    padding-left: 48px !important;
                    padding-right: 40px !important;
                  }
                  .hs_programme_type select, .hs_programme_type input, .hs-field-programme_type select, .hs-field-programme_type input, select[name="programme_type"], input[name="programme_type"] {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat, no-repeat !important;
                    background-position: 16px center, calc(100% - 16px) center !important;
                    background-size: 20px, 16px !important;
                    padding-left: 48px !important;
                    padding-right: 40px !important;
                  }
                  select {
                    appearance: none !important;
                    -webkit-appearance: none !important;
                    -moz-appearance: none !important;
                  }
                  /* GDPR consent section alignment */
                  .hs-field-gdpr_consent, .hs-field-consent, .hs_gdpr_consent, .hs_consent {
                    background: #F8FAFC !important;
                    border: 1.5px solid #F1F5F9 !important;
                    border-radius: 16px !important;
                    padding: 24px !important;
                    margin-top: 10px !important;
                    box-sizing: border-box !important;
                  }
                  .hs-field-gdpr_consent > label:first-of-type, .hs-field-consent > label:first-of-type, .hs_gdpr_consent > label:first-of-type, .hs_consent > label:first-of-type {
                    display: none !important;
                  }
                  .hs-field-gdpr_consent label, .hs-field-consent label, .hs-dependent-field label {
                    text-transform: none !important;
                    font-weight: 500 !important;
                    font-size: 13px !important;
                    letter-spacing: normal !important;
                    color: #475569 !important;
                    display: flex !important;
                    align-items: flex-start !important;
                    gap: 12px !important;
                  }
                  .hs-field-gdpr_consent input, .hs-field-consent input {
                    width: 18px !important;
                    height: 18px !important;
                    margin-top: 2px !important;
                    flex-shrink: 0 !important;
                  }
                  /* Submit button alignment and theme */
                  .hs_submit, .hs-submit {
                    grid-column: span 2 !important;
                    text-align: left !important;
                  }
                  .hs-button, input[type="submit"] {
                    display: inline-block !important;
                    width: auto !important;
                    min-width: 280px !important;
                    padding: 18px 36px !important;
                    background: #7a152d !important;
                    color: #fff !important;
                    border: none !important;
                    border-radius: 12px !important;
                    font-size: 16px !important;
                    font-weight: 700 !important;
                    cursor: pointer !important;
                    box-shadow: 0 10px 25px -5px rgba(122, 21, 45, 0.25) !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                    margin-top: 16px !important;
                    font-family: inherit !important;
                    transition: all 0.3s ease !important;
                  }
                  .hs-button:hover, input[type="submit"]:hover {
                    background: #96223e !important;
                    transform: translateY(-2px) !important;
                  }
                  .hs-error-msgs {
                    list-style: none !important;
                    padding: 0 !important;
                    margin: 4px 0 0 0 !important;
                    color: #ef4444 !important;
                    font-size: 12px !important;
                    font-weight: 600 !important;
                  }
                  .hs-error-msg,
                  .hs-main-font-element,
                  .hs-error-msg.hs-main-font-element {
                    color: #ef4444 !important;
                    font-size: 13px !important;
                    font-weight: 500 !important;
                    margin-top: 4px !important;
                    display: block !important;
                    font-family: inherit !important;
                  }
                  /* Completely suppress default HubSpot thank you / submitted message */
                  .submitted-message,
                  .submitted-message *,
                  .hs-message,
                  .hs_message_container,
                  .hs-form-submitted {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                  }
                  .hs-button:disabled, input[type="submit"]:disabled {
                    background: #7a152d !important;
                    color: #fff !important;
                    opacity: 0.9 !important;
                    cursor: wait !important;
                  }
                  @media (max-width: 600px) {
                    form {
                      grid-template-columns: 1fr !important;
                      gap: 14px !important;
                    }
                    .hs-form-row {
                      display: flex !important;
                      flex-direction: column !important;
                      gap: 14px !important;
                    }
                    .hs-form-field, .hs_submit, .hs-submit {
                      grid-column: span 1 !important;
                      width: 100% !important;
                      max-width: 100% !important;
                    }
                    .hs-field-gdpr_consent, .hs-field-consent, .hs_gdpr_consent, .hs_consent {
                      padding: 14px !important;
                      border-radius: 12px !important;
                    }
                    .hs-button, input[type="submit"] {
                      width: 100% !important;
                      min-width: 0 !important;
                      max-width: 100% !important;
                      padding: 14px 14px !important;
                      font-size: 13.5px !important;
                      box-sizing: border-box !important;
                      white-space: normal !important;
                      text-align: center !important;
                      letter-spacing: 0.02em !important;
                      line-height: 1.3 !important;
                    }
                  }
                `;
                iframeDoc.head.appendChild(styleEl);
              }
            } catch (e) {
              // Cross-origin styling injection prevented
            }

            // Automatically set submit button text to match the PSD design
            const targetNode = formEl || iframeDoc?.body || container;

            const updateSubmitButtonText = () => {
              try {
                const submitBtn =
                  searchRoot.querySelector?.('input[type="submit"]') ||
                  searchRoot.querySelector?.('.hs-button') ||
                  docContext.querySelector('input[type="submit"]') ||
                  docContext.querySelector('.hs-button') ||
                  document.querySelector('.hs-button') ||
                  document.querySelector('input[type="submit"]');
                if (submitBtn) {
                  const currentText = (submitBtn.value || submitBtn.textContent || '').trim();
                  if (currentText && !currentText.includes('Construct Detailed Roadmap')) {
                    const newText = 'Construct Detailed Roadmap \u2192';
                    if (observerInstance) {
                      observerInstance.disconnect();
                    }
                    if (submitBtn.tagName === 'INPUT') {
                      submitBtn.value = newText;
                    } else {
                      submitBtn.textContent = newText;
                    }
                    if (observerInstance && targetNode) {
                      observerInstance.observe(targetNode, { childList: true, subtree: true, characterData: true, attributes: true });
                    }
                  }
                }
              } catch (e) {
                // Silent catch for DOM timing/cross-origin
              }
            };

            updateSubmitButtonText();
            const textInterval = setInterval(updateSubmitButtonText, 100);
            setTimeout(() => clearInterval(textInterval), 5000);

            // Active MutationObserver tracking to watch for validation state swaps
            try {
              observerInstance = new MutationObserver(updateSubmitButtonText);
              if (targetNode) {
                observerInstance.observe(targetNode, { childList: true, subtree: true, characterData: true, attributes: true });
              }
            } catch (e) {
              // MutationObserver setup skipped
            }

            Object.entries(assessmentData).forEach(([key, value]) => {
              const inputElement =
                searchRoot.querySelector?.(`input[name="${key}"]`) ||
                searchRoot.querySelector?.(`input[name="${key}"].hs-input`) ||
                docContext.querySelector(`input[name="${key}"]`) ||
                docContext.querySelector(`input[name="${key}"].hs-input`) ||
                document.querySelector(`input[name="${key}"].hs-input`);

              if (inputElement) {
                inputElement.value = value;
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                inputElement.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });
          },
          onFormSubmit: ($form, submittedData) => {
            if (onSubmittingRef.current) {
              onSubmittingRef.current();
            }
            // Bulletproof extraction strategy to guarantee we capture the values
            // regardless of whether HubSpot loads in an iframe, uses jQuery, or passes data arrays.
            const getValue = (name) => {
              // 1. Array payload
              if (Array.isArray(submittedData)) {
                const match = submittedData.find(d => d.name === name);
                if (match && match.value) return match.value;
              }
              // 2. Object payload
              if (submittedData && typeof submittedData === 'object' && !Array.isArray(submittedData)) {
                if (submittedData[name]) return submittedData[name];
              }
              // 3. jQuery serialization
              if ($form && typeof $form.serializeArray === 'function') {
                const arr = $form.serializeArray();
                const match = arr.find(item => item.name === name);
                if (match && match.value) return match.value;
              }
              // 4. Local DOM context
              const el = ($form && $form[0]) ? $form[0] : $form;
              if (el && typeof el.querySelector === 'function') {
                const input = el.querySelector(`[name="${name}"]`);
                if (input && input.value) return input.value;
              }
              // 5. Global DOM boundary fallback
              const globalInput = document.querySelector(`[name="${name}"].hs-input`);
              if (globalInput && globalInput.value) return globalInput.value;

              return '';
            };

            capturedLeadData = {
              first_name: getValue('firstname') || 'HubSpot',
              last_name: getValue('lastname') || 'Lead',
              email: getValue('email'),
              company: getValue('company') || 'N/A',
              job_title: getValue('jobtitle') || 'N/A',
              country: getValue('country') || 'N/A',
              gdpr_consent: true,
            };

            // Fallback: If onFormSubmitted doesn't fire within 1500ms, proceed automatically
            setTimeout(() => {
              if (onFormSubmittedRef.current && capturedLeadData && !hasSubmittedRef.current) {
                hasSubmittedRef.current = true;
                onFormSubmittedRef.current(capturedLeadData);
              }
            }, 1500);
          },
          onFormSubmitted: () => {
            // Send extracted values when the transmission is safely finalized
            if (onFormSubmittedRef.current && capturedLeadData && !hasSubmittedRef.current) {
              hasSubmittedRef.current = true;
              onFormSubmittedRef.current(capturedLeadData);
            }
          }
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      if (observerInstance) {
        observerInstance.disconnect();
      }
      // Cleanup: Remove the script when component unmounts
      const existingScript = document.querySelector(`script[src="//js-${region}.hsforms.net/forms/embed/v2.js"]`);
      if (existingScript) {
        existingScript.remove();
      }
      formInitializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalId, formId, region]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="dap-hubspot-form-container"
      ref={containerRef}
    >
      <div id={`hubspot-form-${formId}`} className="dap-hubspot-form" />
    </motion.div>
  );
}
