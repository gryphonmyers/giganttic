
const ONE_DAY_MS = 86400000;
const TASKS = Symbol();
const DEPENDENCIES = Symbol();
const INVALID_DEPENDENCIES = Symbol();
const RENDERED_TASKS = Symbol();

export default ({ HTMLElement, document, litHtml: {directives: {styleMap, classMap, repeat, ifDefined}, html, render} }) => 
  class GanttBoardElement extends HTMLElement {

    static get observedAttributes() { 
        return [
          'tasks',
          'dependencies',
          'cell-width',
          'cell-height',
          'start-date'
        ]; 
    }
    
    get startDate() {
      const attr = this.getAttribute('start-date');
      return new Date(isNaN(attr)
          ? attr
          : Number(attr));
    }
    
    set startDate(val) {
      this.setAttribute('start-date', Number(val));
    }

    get startDay() {
      return this.startDate.getDay();
    }

    get cellWidth() {
      return Number(this.getAttribute('cell-width'));
    }

    set cellWidth(val) {
      this.setAttribute('cell-width', val);
    }

    get cellHeight() {
      return Number(this.getAttribute('cell-height'));
    }

    set cellHeight(val) {
      this.setAttribute('cell-height', val);
    }

    get tasks() {
      return this[TASKS];
    }

    get dependencies() {
      return this[DEPENDENCIES];
    }

    constructor() {
      super();
      this[INVALID_DEPENDENCIES] = {};
      this.attachShadow({mode: 'open'});
      this.dragOperations = new Map;
      this.selectedTasks = [];
      
      document.addEventListener('mouseup', evt => {
        if (this.startSelection) {
          const selectArea = this.selectionArea;

          this.selectedTasks = [...this.selectedTasks, ...this.tasks.filter(task => {
            if (this.selectedTasks.includes(task)) {
              return false;
            }
            const elRect = this.shadowRoot.getElementById(`gantt-task-${task.id}`).getBoundingClientRect();
          
            return elRect.x < selectArea.x + selectArea.width &&
              elRect.x + elRect.width > selectArea.x &&
              elRect.y < selectArea.y + selectArea.height &&
              elRect.y + elRect.height > selectArea.y;
          })];
          delete this.selectionArea;
          delete this.startSelection;
        }
        const referenceDate = this.startDate;
        this.dragOperations.forEach(({task,span,offset}) => {
          // console.log('Drag opperation', task, span, offset)
          this.dragOperations.delete(task.id);
          if (offset !== task.offset) {
            // debugger;
            this.dispatchEvent(new CustomEvent('taskoffsetchange', {
              detail: {
                taskId: task.id,
                offset,
                referenceDate
              }
            }));
          }

          if (span !== task.span) {
            this.dispatchEvent(new CustomEvent('taskspanchange', {
              detail: {
                taskId: task.id,
                span,
                referenceDate
              }
            }));
          }
        });
        
        this.dragOperations.clear();

        this.rerender();

      });

      document.addEventListener('mousemove', evt => {
        if (this.startSelection) {
          const x = Math.min(this.startSelection.clientX, evt.clientX);
          const y = Math.min(this.startSelection.clientY, evt.clientY);

          this.selectionArea = {
            x,
            y,
            width: Math.max(this.startSelection.clientX, evt.clientX) - x,
            height: Math.max(this.startSelection.clientY, evt.clientY) - y
          }
        }
        let shouldRerender = false;
        this.dragOperations.forEach((operation) => {
          const { dragType, startX, task } = operation;
          const dx = evt.clientX - startX;


          var prevSpan = operation.span;
          var prevOffset = operation.offset;

          switch (dragType) {
            case 'resize-left':
              operation.span = Math.max(1, task.span - Math.round(dx / this.cellWidth));
              operation.offset = Math.min(task.offset + task.span - 1, Math.max(-Infinity, task.offset + Math.round(dx / this.cellWidth)));
              break;
            case 'resize-right':
              operation.span = Math.max(1, task.span + Math.round(dx / this.cellWidth));
              break;
            case 'move':
              operation.offset = Math.max(-Infinity, task.offset + Math.round(dx / this.cellWidth));
              break;
            default:
              throw new Error(`Unrecognized drag type, "${dragType}"`);
          }

          if (operation.span !== prevSpan || operation.offset !== prevOffset) {
            shouldRerender = true;
          }      
        });
        if (shouldRerender) {
          this.updateTasksAsRendered();
        }
        if (this.selectionArea || shouldRerender) {
          this.rerender();
        }
      });
    }

    get isResizingTask() {
      return Array.from(this.dragOperations.values())
        .some(item => ['resize-left', 'resize-right'].includes(item.dragType));
    }

    get isMovingTask() {
      return Array.from(this.dragOperations.values())
        .some(item => ['move'].includes(item.dragType));
    }

    get dates() {
      return Array.from({ length: this.numCols })
        .map((v, ii) => new Date(Number(this.startDate) + (ii * ONE_DAY_MS)));
    }

    get numCols() {
      return this.tasks
        ? this.tasks.reduce((acc, task) => Math.max(acc, task.offset + task.span), 0)
        : 0;
    }

    get datesGroupedByMonth() {
      const datesGroupedByMonth = [];
      const groups = {};

      const formatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
      
      this.dates.forEach(date => {
        const formatted = formatter.format(date);
        if (!(formatted in groups)) {
          groups[formatted] = [];
          datesGroupedByMonth.push(formatted);
        }
        groups[formatted].push(date);
      });

      return datesGroupedByMonth.map(month => [month, groups[month]])
    }

    get months() {
      const formatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
      const cache = {};

      return this.dates.reduce((acc, date) => {
        const formatted = formatter.format(date);

        if (formatted in cache) {
          return acc;
        }
        cache[formatted] = 1;

        return [...acc, formatted];
      }, []);
    }

    get gridWidth() {
      return this.numCols * this.cellWidth
    }

    get gridHeight() {
      return this.numRows * this.cellHeight
    }

    get tasksById() {
      return new Map(this.tasks.map(task => [task.id, task]));
    }

    get numRows() {
      return this.tasks
        ? this.tasks.length
        : 0;
    }

    get invalidDependencies() {
      return this[INVALID_DEPENDENCIES];
    }

    getTaskAsRendered(id) {
      const task = this.tasksById.get(id);
      return task && Object.assign({}, task, {
        span: (this.dragOperations.has(id)
          ? this.dragOperations.get(id).span
          : task.span),
        offset: (this.dragOperations.has(id)
          ? this.dragOperations.get(id).offset
          : task.offset)
      })
    }
    
    get renderedTasks() {
      return this[RENDERED_TASKS];
    }

    get paddedGridWidth() {
      return this.gridWidth + (this.cellWidth * 2);
    }
    
    get paddedGridHeight() {
      return this.gridHeight + (this.cellHeight * 2);
    }

    get totalSelectedScore() {
      return this.selectedTasks
        .reduce((acc, curr) => acc + (curr.metadata.score || 0), 0);
    }

    renderHtml({tasks, cellWidth, cellHeight}) {

      const onTaskLeftHandleClick = (evt, clickedTask) => {
        evt.stopPropagation();
        evt.preventDefault();
        if (evt.shiftKey) {
          this.selectedTasks.push(clickedTask)
        }
        if (!this.selectedTasks.some(task => task.id === clickedTask.id)) {
          this.selectedTasks = [];
        }

        new Set([...this.selectedTasks, clickedTask]).forEach(currTask => {
          const task = this.getTaskAsRendered(currTask.id);

          this.dragOperations.set(task.id, { 
            span: task.span, 
            offset: task.offset, 
            dragType: 'resize-left', 
            startX: evt.clientX, 
            task
          });
        });        

        this.rerender();
      };

      const onTaskRightHandleClick = (evt, clickedTask) => {
        evt.stopPropagation();
        evt.preventDefault();
        if (evt.shiftKey) {
          this.selectedTasks.push(clickedTask)
        }
        if (!this.selectedTasks.some(task => task.id === clickedTask.id)) {
          this.selectedTasks = [];
        }

        new Set([...this.selectedTasks, clickedTask]).forEach(currTask => {
          const task = this.getTaskAsRendered(currTask.id);
          
          this.dragOperations.set(task.id, { 
            span: task.span, 
            offset: task.offset, 
            dragType: 'resize-right', 
            startX: evt.clientX, 
            task 
          });
        }); 

        this.rerender();
      };

      const onTaskClick = (evt, clickedTask) => {
        evt.stopPropagation();
        evt.preventDefault();
        if (evt.shiftKey) {
          this.selectedTasks.push(clickedTask)
        }
        if (!this.selectedTasks.some(task => task.id === clickedTask.id)) {
          this.selectedTasks = [];
        }

        new Set([...this.selectedTasks, clickedTask]).forEach(currTask => {
          const task = this.getTaskAsRendered(currTask.id);
          
          this.dragOperations.set(task.id, { 
            span: task.span, 
            offset: task.offset, 
            dragType: 'move', 
            startX: evt.clientX, 
            task 
          });
        });

        this.rerender();
      }

      const onGridClick = evt => {
        evt.stopPropagation();
        evt.preventDefault();

        if (!evt.shiftKey) {
          this.selectedTasks = [];
        }
        this.startSelection = evt;
        this.selectionArea = {
          x: evt.clientX,
          y: evt.clientY,
          width: 0,
          height: 0
        }
      }
const gridStyles = {
  '--gantt-selection-x': (this.startSelection && `${this.selectionArea.x}px`) || '',
  '--gantt-selection-y': (this.startSelection && `${this.selectionArea.y}px`) || '',
  '--gantt-selection-width': (this.startSelection && `${this.selectionArea.width}px`) || '',
  '--gantt-selection-height': (this.startSelection && `${this.selectionArea.height}px`) || ''
}
      render(
        html`
          <style>
            .gantt-board {
              display: grid;
              grid-template-areas: 
                ". header"
                "titles grid";
              grid-template-columns: auto 1fr;

            }

            .gantt-board__titles {
              grid-area: titles;
              transition: 0.25s width;
              width: 200px;
              padding: var(--gantt-cell-height) 0;
            }

            .gantt-board__title--complete {
              text-decoration: line-through;
            }

            .gantt-board__titles:hover {
              width: 350px;
            }

            .gantt-board__title {
              display: block;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              height: var(--gantt-cell-height);
              line-height: var(--gantt-cell-height);
              font-size: 0.9em;
              padding: 0 5px;
              box-sizing: border-box;
            }

            .gantt-board__header {
              grid-area: header;
            }

            .gantt-board--resizing-task {
              cursor: col-resize;
            }

            .gantt-board--moving-task {
              cursor: move;
            }

            .gantt-board:not(.gantt-board--resizing-task) .gantt-board__task {
              cursor: move;
            }

            .gantt-board:not(.gantt-board--moving-task) .gantt-board__task-handle {
              cursor: col-resize;
            }

            .gantt-board__task {
              background-color: var(--gantt-task-color, #dedede);
              opacity: 1;
              display: flex;
              justify-content: flex-start;
              /* margin: 5px; */
              height: var(--gantt-cell-height);
              /* padding: 2px 0; */
              box-sizing: border-box;
              border: 1px solid var(--gantt-task-border-color, gray);
              border-radius: 2px;
              /* margin: 2px 0;               */
              transition: 0.1s opacity ease-in-out;
            }
            
            .gantt-board__task--complete {
              opacity: 0.5;
            }

            .gantt-board__task--resized, .gantt-board__task--moved {
              opacity: 0.5;
            }

            .gantt-board__task-handle {
              border-radius: 2px;
              height: 100%;
              width: 6px;
              background-color: var(--gantt-handle-background, transparent);
              border: 2px solid var(--gantt-handle-border-color, transparent);
              box-sizing: border-box;
            }

            .gantt-board__header-dates {
              display: flex;
            }

            .gantt-board__header-date {
              text-align: center;
              flex-basis: var(--gantt-cell-width);
              width: var(--gantt-cell-width);
            }

            .gantt-board__header-months {
              display: flex;
              justify-content: flex-start;
              padding: 0 var(--gantt-cell-width);
            }

            .gantt-board__task-handle--left {
              margin-left: -2px;
            }

            .gantt-board__task-handle--right {
              margin-right: -2px;
              margin-left: auto;
            }

            .gantt-board__grid {
              cursor: crosshair;
              grid-area: grid;
              position: relative;
              padding: var(--gantt-cell-height) var(--gantt-cell-width);
            }
            
            .gantt-board__grid::before {
              content: '';
              display: block;
              position: fixed;
              left: var(--gantt-selection-x);
              top: var(--gantt-selection-y);
              width: var(--gantt-selection-width);
              height: var(--gantt-selection-height);
              z-index: 2;
              background-color: rgba(0,0,0,0.2);
            }

            .gantt-board__task--has-invalid-deps {
              border: 1px solid red;
            }

            .gantt-board__task-label {
              
              
              display: block;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              
            }

            .gantt-board__task-label, .gantt-board__task-score {
              font-size: 0.8em;
              font-family: monospace;
              line-height: var(--gantt-cell-height);
              text-shadow: 1px 0 0 var(--gantt-task-border-color, gray), -1px 0 0 var(--gantt-task-border-color, gray), 0 1px 0 var(--gantt-task-border-color, gray), 0 -1px 0 var(--gantt-task-border-color, gray);
              color: #000;
            }

            .gantt-board__task-score {

            }
            
            .gantt-board__task-score::before {
              content: "(";  
            }

            .gantt-board__task-score::after {
              content: ")";
              margin-right: 5px;
            }

            .gantt-board__title--has-invalid-deps {
              color: red;
            }

            .gantt-board__task--selected {
              border: 1px solid white;
            }

            .gantt-board__selected-hud {
              position: fixed;
              top: 25px;
              left: 25px;
              padding: 20px;
              z-index: 2;
              border-radius: 10px;
              background-color: rgba(155,155,155,0.5);
              transition: 0.25s opacity;
            }

            .gantt-board__selected-hud--empty {
              opacity: 0;
              pointer-events: none;
            }

            .gantt-board__selected-items-total {
              margin: 0 10px;
            }

            .gantt-board__selected-score-total {
              margin: 0 10px;
            }

            .gantt-board__selected-score-total::before {
              content: '(';
            }

            .gantt-board__selected-score-total::after {
              content: ')';
            }

            .gantt-board__grid-canvas {
              position: absolute;
              top: 0;
              left: 0;
              background-position: calc(var(--gantt-cell-width) * calc(1 - var(--gantt-week-start-offset, 0))) 0, 0; /* 1 + is to compensate for 1 cell padding around board */
              background-size: calc(var(--gantt-cell-width) * 7) auto, auto;
              background-image: 
                repeating-linear-gradient(to right,
                  var(--gantt-grid-line-color, #999),
                  var(--gantt-grid-line-color, #999) 1px,
                  transparent 1px,
                  transparent calc(var(--gantt-cell-width) * 7)
                ),
                repeating-linear-gradient(to right,
                  var(--gantt-odd-column-bg-color, #efefef),
                  var(--gantt-odd-column-bg-color, #efefef) var(--gantt-cell-width),
                  var(--gantt-even-column-bg-color, #dfdfdf) var(--gantt-cell-width),
                  var(--gantt-even-column-bg-color, #dfdfdf) calc(var(--gantt-cell-width) * 2)
                );
            }
          </style>

          <div id="wrapper" class=${classMap({ 
            'gantt-board': true, 
            'gantt-board--resizing-task': this.isResizingTask,
            'gantt-board--moving-task': this.isMovingTask,
          })} style=${styleMap({
            '--gantt-cell-height': `${cellHeight}px`,
            '--gantt-cell-width': `${cellWidth}px`,
            '--gantt-week-start-offset': `${this.startDay}`
          })}>
            <header class="gantt-board__header">
              <div class=${classMap({
                "gantt-board__selected-hud": true,
                "gantt-board__selected-hud--empty": !this.selectedTasks.length
              })}>
                <span class="gantt-board__selected-items-total">
                  ${this.selectedTasks.length}
                </span>
                <span class="gantt-board__selected-score-total">
                  ${this.totalSelectedScore}
                </span>
              </div>
              <div class="gantt-board__header-months" id="months">
                ${this.datesGroupedByMonth.map(([month, dates]) => html`
                  <div class="gantt-board__header-month">
                    <h3 class="gantt-board__header-month-heading">${month}</h3>
                    <div  class="gantt-board__header-dates" id="dates">
                      ${dates.map(date => html`
                        <span class="gantt-board__header-date">${date.getDate()}</span>
                      `)}
                    </div>
                  </div>                  
                `)}
              </div>
            </header>

            <div class="gantt-board__titles">
              ${repeat(tasks, (task) => task.id, (task, ii) => html`
                <a class=${classMap({
                  "gantt-board__title": true,
                  "gantt-board__title--complete": task.metadata.isComplete,
                  "gantt-board__title--has-invalid-deps": task.id in this.invalidDependencies
                })} href="${ifDefined(task.metadata.url)}" title="${ifDefined(task.metadata.title)}">
                  ${task.metadata.title || 'Unnamed task'}
                </a>
              `)}
            </div>

            <div id="gantt-grid" style=${styleMap(gridStyles)} class="gantt-board__grid" @mousedown=${onGridClick}>
              <canvas class="gantt-board__grid-canvas" width="${this.paddedGridWidth}" height="${this.paddedGridHeight}" id="gantt-canvas"></canvas>
              ${
                repeat(tasks, (task) => task.id, (task, ii) => html`
                  <div style=${styleMap({
                    '--gantt-task-color': task.metadata.color || '',
                    '--gantt-task-border-color': task.metadata.borderColor || '',
                    width: `${task.span * cellWidth}px`, 
                    transform: `translateX(${task.offset * cellWidth}px)` 
                  })} @mousedown=${evt => onTaskClick(evt, task)} class=${classMap({
                    "gantt-board__task--has-invalid-deps": task.id in this.invalidDependencies,
                    "gantt-board__task": true,
                    "gantt-board__task--complete": task.metadata.isComplete,
                    "gantt-board__task--selected": this.selectedTasks.some(selectedTask => task.id == selectedTask.id),
                    "gantt-board__task--dragged": this.dragOperations.has(task.id),
                    "gantt-board__task--moved": this.dragOperations.has(task.id) && this.dragOperations.get(task.id).dragType === 'move',
                    "gantt-board__task--resized-left": this.dragOperations.has(task.id) && this.dragOperations.get(task.id).dragType === 'resize-left',
                    "gantt-board__task--resized-right": this.dragOperations.has(task.id) && this.dragOperations.get(task.id).dragType === 'resize-right',
                    "gantt-board__task--resized": this.dragOperations.has(task.id) && ['resize-right', 'resize-left'].includes(this.dragOperations.get(task.id).dragType),
                  })} id="gantt-task-${task.id}" title="${ifDefined(task.metadata.title)}">
                      <div @mousedown=${evt => onTaskLeftHandleClick(evt, task)} class="gantt-board__task-handle gantt-board__task-handle--left"></div>
                      ${ task.metadata.score != null
                          ? html`<span class="gantt-board__task-score">${task.metadata.score}</span>`
                          : ''
                      }
                      <span class="gantt-board__task-label">${task.metadata.title}</span>
                      <div @mousedown=${evt => onTaskRightHandleClick(evt, task)} class="gantt-board__task-handle gantt-board__task-handle--right"></div>
                  </div>
                `)
              }
            </div>
          </div>
        `
      , this.shadowRoot)
    }

    connectedCallback() {
      this.rerender();
    }

    rerender() {
      this.renderHtml({ 
        tasks: this.renderedTasks || [],
        cellWidth: this.cellWidth,
        cellHeight: this.cellHeight
      });

      this.renderCanvas();
    }

    renderCanvas() {
      const ctx = this.shadowRoot.querySelector('#gantt-canvas').getContext('2d');
      
      ctx.clearRect(0, 0, this.paddedGridWidth, this.paddedGridHeight);
      
      this.drawArrows(ctx);
    }

    updateTasksAsRendered() {
      this[RENDERED_TASKS] = this[TASKS] 
            ? this[TASKS].map(task => {
              return this.getTaskAsRendered(task.id)
            })
            : [];
    }

    drawArrows(ctx) {
      ctx.save();
      const dependencies = this.dependencies;
      ctx.lineWidth = 1;
      const xOffset = this.cellWidth;
      const yOffset = this.cellHeight;
      

      if (dependencies) {
        const tasks = this.renderedTasks;

        tasks.forEach((task, rowIndex) => {
          if (task.id in dependencies) {
            const depTaskIds = dependencies[task.id];
    
            depTaskIds.forEach(depTaskId => {        
              const depTaskIndex = tasks.findIndex((task) => task.id == depTaskId);
              const depTask = tasks[depTaskIndex];

              if (depTask) {
                ctx.beginPath();

                if (task.id in this.invalidDependencies && this.invalidDependencies[task.id].includes(depTaskId)) {
                  ctx.strokeStyle = "red";
                  ctx.fillStyle = "red";
                } else {
                  ctx.strokeStyle = "black";
                  ctx.fillStyle = "black";
                }

                const srcTaskX = xOffset + (task.offset * this.cellWidth);
                const srcTaskY = yOffset + (rowIndex * this.cellHeight) + (this.cellHeight / 2);

                const depTaskX = xOffset + (depTask.offset * this.cellWidth);
                const depTaskY = yOffset + (depTaskIndex * this.cellHeight) + (this.cellHeight / 2);

                ctx.moveTo(srcTaskX, srcTaskY);

                if (depTaskX > srcTaskX) {
                  //Loop around so line doesn't pass through task
                  ctx.lineTo(srcTaskX - 5, srcTaskY);
                  ctx.lineTo(srcTaskX - 5, srcTaskY + (this.cellHeight / 2) + 5);

                  ctx.lineTo(depTaskX - 10, srcTaskY + (this.cellHeight / 2) + 5);
                } else {
                  ctx.lineTo(depTaskX - 10, srcTaskY);
                }
                
                ctx.lineTo(depTaskX - 10, depTaskY);
                ctx.lineTo(depTaskX - 5, depTaskY);

                ctx.stroke();
                ctx.closePath();

                //Draw arrow head

                ctx.beginPath();
                ctx.moveTo(depTaskX, depTaskY);
                ctx.lineTo(depTaskX - 5, depTaskY + 5);
                ctx.lineTo(depTaskX - 5, depTaskY - 5);
                ctx.fill();
                ctx.closePath();
              }
            });
          }
        });
      }      

      ctx.restore();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      switch (name) {
        case 'tasks':
          this[TASKS] = JSON.parse(newValue);
          this.updateTasksAsRendered();
          break;
        case 'dependencies':
          this[DEPENDENCIES] = JSON.parse(newValue);
          const tasksById = this.tasksById;
          this[INVALID_DEPENDENCIES] = !this.dependencies
            ? {}
            : Object.entries(this[DEPENDENCIES])
              .reduce((acc, [srcId, depIds]) => {
                const srcTask = tasksById.get(srcId);
      
                const invalidDeps = depIds.filter(id => {
                  const depTask = tasksById.get(id);
                  
                  return depTask && (depTask.offset + depTask.span) > (srcTask.offset + srcTask.span);
                });
      
                if (invalidDeps.length) {
                  return Object.assign(acc, { [srcId]: invalidDeps });
                }
      
                return acc;
              }, {});
          break;
      }
      this.rerender();
    }
  }