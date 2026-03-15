document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const elements = {
      title: document.getElementById('lesson-title'),
      counter: document.getElementById('step-counter'),
      progressBar: document.getElementById('progress-bar-fill'),
      mediaLayer: document.getElementById('media-layer'),
      panel: document.getElementById('overlay-panel'),
      toggleBtn: document.getElementById('toggle-panel-btn'),
      panelHeader: document.querySelector('.panel-header'),
      stepTitle: document.getElementById('step-title'),
      instructionText: document.getElementById('instruction-text'),
      responseArea: document.getElementById('response-area'),
      responseLabel: document.getElementById('response-label'),
      inputContainer: document.getElementById('input-container'),
      btnBack: document.getElementById('btn-back'),
      btnNext: document.getElementById('btn-next')
    };
  
    // --- State ---
    let lessonData = null;
    let allSteps = [];
    let currentStepIndex = 0;
    // Map to store learner responses: { step_id: value }
    const learnerResponses = {};
  
    // --- Logic ---
    async function init() {
      setupEventListeners();
      try {
        const response = await fetch('lesson4.json');
        if (!response.ok) throw new Error('Failed to load JSON');
        const data = await response.json();
        processLessonData(data);
        renderStep(currentStepIndex);
      } catch (error) {
        console.error('Error initializing lesson:', error);
        elements.title.textContent = 'Error Loading Lesson';
      }
    }
  
    function processLessonData(data) {
      // In this POC we pick the first lesson in the array
      lessonData = data[0];
      elements.title.textContent = lessonData.lesson_title;
  
      // Flatten steps from all activities into a single array
      allSteps = [];
      if (lessonData.activities) {
        lessonData.activities.forEach(activity => {
          if (activity.steps) {
            activity.steps.forEach(step => {
                // Attach activity context
                step._activity_title = activity.activity_title;
                allSteps.push(step);
            });
          }
        });
      }
    }
  
    function setupEventListeners() {
      // Panel toggle logic
      const togglePanel = () => {
        elements.panel.classList.toggle('minimized');
      };
      elements.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent header click from firing twice
        togglePanel();
      });
      elements.panelHeader.addEventListener('click', togglePanel);
  
      // Navigation
      elements.btnNext.addEventListener('click', () => {
          if (currentStepIndex < allSteps.length - 1) {
              saveResponse();
              currentStepIndex++;
              renderStep(currentStepIndex);
          } else {
              alert("Lesson Completed! (POC end)");
          }
      });
  
      elements.btnBack.addEventListener('click', () => {
          if (currentStepIndex > 0) {
              saveResponse();
              currentStepIndex--;
              renderStep(currentStepIndex);
          }
      });
    }
  
    function saveResponse() {
        // Find input if it exists
        const step = allSteps[currentStepIndex];
        if (step.learner_response) {
            const input = document.getElementById('current-input');
            if (input) {
               learnerResponses[step.step_id] = input.value;
            }
        }
    }
  
    function renderStep(index) {
      if (!allSteps || allSteps.length === 0) return;
  
      const step = allSteps[index];
      const totalSteps = allSteps.length;
  
      // Update Progress
      elements.counter.textContent = `Step ${index + 1} of ${totalSteps}`;
      const progressPercent = ((index) / (totalSteps - 1)) * 100;
      elements.progressBar.style.width = `${progressPercent}%`;
  
      // Update Navigation Buttons
      elements.btnBack.disabled = (index === 0);
      
      // Update Text Content
      elements.stepTitle.textContent = step.title;
      
      let instructionsTextHtml = `<p><strong>${step._activity_title}</strong></p>`;
      instructionsTextHtml += `<p>${step.instruction_text.replace(/\n/g, '<br>')}</p>`;
      elements.instructionText.innerHTML = instructionsTextHtml;
  
      // Handle Media Layer
      renderMedia(step);
      
      // Handle Inputs / Responses
      renderResponseArea(step);
  
      // Ensure panel is expanded when new step loads
      elements.panel.classList.remove('minimized');
    }
  
    function renderMedia(step) {
      elements.mediaLayer.innerHTML = ''; // Clear current media
  
      if (step.interactive_or_media) {
        elements.panel.classList.remove('centered');
        const media = step.interactive_or_media;
        
        let url = media.media_url;
        
        // INTERCEPT LOGIC FOR LOCAL POCKET MOUSE POC
        if (url && url.toUpperCase().includes('POCKET%20MOUSE-NATURAL%20SELECTION_V2.HTML')) {
          url = 'Pocket Mouse-Natural Selection_v2.html';
        }
  
        if (media.media_type === 'video' || media.media_type === 'simulation') {
           if (media.media_type === 'video' && url.includes('youtube.com')) {
               url += (url.includes('?') ? '&' : '?') + 'autoplay=1';
           }

           const iframe = document.createElement('iframe');
           iframe.className = 'media-frame';
           iframe.src = url;
           iframe.allowFullscreen = true;
           iframe.setAttribute('allow', 'autoplay; fullscreen');
           iframe.title = media.media_title;
           elements.mediaLayer.appendChild(iframe);
        } else if (media.media_type === 'image') {
           const img = document.createElement('img');
           img.className = 'media-image';
           img.src = url;
           img.alt = media.media_title;
           elements.mediaLayer.appendChild(img);
        } else {
             // Fallback
             elements.mediaLayer.innerHTML = `<div class="media-placeholder"><p>Unsupported media type: ${media.media_type}</p></div>`;
        }
      } else {
        // No media for this step -> center the panel
        elements.panel.classList.add('centered');
        elements.mediaLayer.innerHTML = ``; // Keep background clean
      }
    }
  
    function renderResponseArea(step) {
       elements.inputContainer.innerHTML = ''; // clear old inputs
       elements.btnNext.disabled = false; // default to enabled
       elements.btnNext.textContent = (currentStepIndex === allSteps.length - 1) ? 'Finish' : 'Continue';
  
       if (step.learner_response) {
           elements.responseArea.classList.remove('hidden');
           elements.responseLabel.textContent = step.learner_response.prompt;
           
           let inputEl = null;
  
           if (step.learner_response.response_type === 'dropdown') {
               inputEl = document.createElement('select');
               inputEl.id = 'current-input';
               
               const defaultOption = document.createElement('option');
               defaultOption.value = '';
               defaultOption.textContent = step.learner_response.placeholder || 'Select...';
               defaultOption.disabled = true;
               defaultOption.selected = true;
               inputEl.appendChild(defaultOption);
               
               if (step.learner_response.options) {
                   step.learner_response.options.forEach(opt => {
                       const option = document.createElement('option');
                       option.value = opt;
                       option.textContent = opt;
                       inputEl.appendChild(option);
                   });
               }
           } else if (step.learner_response.response_type === 'text_long') {
               inputEl = document.createElement('textarea');
               inputEl.id = 'current-input';
               inputEl.placeholder = step.learner_response.placeholder || '';
               if (step.learner_response.max_length) {
                   inputEl.maxLength = step.learner_response.max_length;
               }
           } else {
               // default text short
               inputEl = document.createElement('input');
               inputEl.type = 'text';
               inputEl.id = 'current-input';
               inputEl.placeholder = step.learner_response.placeholder || '';
               if (step.learner_response.max_length) {
                inputEl.maxLength = step.learner_response.max_length;
               }
           }
  
           // Restore previous answer if it exists
           if (learnerResponses[step.step_id]) {
               inputEl.value = learnerResponses[step.step_id];
           }
  
           elements.inputContainer.appendChild(inputEl);
  
           // Validation Logic for the Next Button
           if (step.learner_response.response_required) {
               elements.btnNext.disabled = !inputEl.value.trim();
               // Change next button to explicit submit action text
               elements.btnNext.textContent = 'Submit';
  
               inputEl.addEventListener('input', () => {
                   elements.btnNext.disabled = !inputEl.value.trim();
               });
               inputEl.addEventListener('change', () => {
                   elements.btnNext.disabled = !inputEl.value.trim();
               });
           }
  
       } else {
           // No response required
           elements.responseArea.classList.add('hidden');
       }
    }
  
    // --- Boot ---
    init();
  });
