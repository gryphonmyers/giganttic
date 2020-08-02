import EventEmitter from "isomitter";
import createGanttBoardElementClass from "./create-gantt-board-element-class";
import createGanttBoardClass from "./gantt-board";
import createGanttTaskClass from "./gantt-task";

import { html, render } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat';
import { styleMap } from 'lit-html/directives/style-map';
import { classMap } from 'lit-html/directives/class-map';
import { ifDefined } from 'lit-html/directives/if-defined';
import { throttle, debounce } from 'throttle-debounce';
 
const Task = createGanttTaskClass({ EventEmitter });
const Board = createGanttBoardClass({ EventEmitter, Task });

const BOARD = Symbol();
const GANTT_EL = Symbol();

export class BrowserGanttBoard extends EventEmitter {

    constructor(opts={}) {
        super();
        const { el, tasks, taskSort, cellHeight, cellWidth } = opts;

        if (opts.window && !window) window = opts.window;

        const { HTMLElement, document, customElements } = window;

        this[BOARD] = new Board({ tasks, taskSort, cellHeight, cellWidth });

        const startDateEvents = [];
        const endDateEvents = [];
        const updateAttributes = throttle(20, false, (evt) => {
            this.updateAttributes();           
        });

        const fireEvents = debounce(20, (evt) => {
            const taskEventsById = endDateEvents.reduce((acc, {task, newDate}) => {
                if (!acc[task.id]) {
                    acc[task.id] = { task, newStartDate: task.startDate, newEndDate: task.endDate }
                }

                Object.assign(acc[task.id], { newEndDate: newDate });

                return acc;

            }, startDateEvents.reduce((acc, {task, newDate}) => {
                if (!acc[task.id]) {
                    acc[task.id] = { task, newStartDate: task.startDate, newEndDate: task.endDate }
                }

                Object.assign(acc[task.id], { newStartDate: newDate });

                return acc;
            }, {}));

            startDateEvents.splice(0, startDateEvents.length);
            endDateEvents.splice(0, endDateEvents.length);

            Object.values(taskEventsById)
                .forEach(evt => this.emit('taskdateschange', evt));
        });

        this[BOARD].on('dependencieschange', updateAttributes);
        this[BOARD].on('taskflooredstartdatechange', (evt) => {
            startDateEvents.push(evt);
            updateAttributes();
            fireEvents();
        });
        this[BOARD].on('taskflooredenddatechange', (evt) => {
            endDateEvents.push(evt);
            updateAttributes();
            fireEvents();
        });
        this[BOARD].on('taskremoved', updateAttributes);
        this[BOARD].on('taskadded', updateAttributes);

        const GanttBoardElement = createGanttBoardElementClass({ 
            litHtml: {
                render, 
                html,
                directives: {
                    repeat,
                    classMap,
                    styleMap,
                    ifDefined
                }
            }, 
            HTMLElement, 
            document 
        });
        
        customElements.define('gantt-board', GanttBoardElement);

        const queuedChanges = [];

        const requestBoardUpdate = async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
            queuedChanges.forEach(change => this[BOARD].updateRow(change));
            queuedChanges.splice(0, queuedChanges.length);
        }

        this[GANTT_EL] = document.createElement('gantt-board');
        this[GANTT_EL].addEventListener('taskoffsetchange', ({detail: { taskId, offset, referenceDate }}) => {
            queuedChanges.push({ id: taskId, offset, referenceDate });

            requestBoardUpdate();
        });

        this[GANTT_EL].addEventListener('taskspanchange', ({detail: { taskId, span }}) => {
            queuedChanges.push({ id: taskId, span });

            requestBoardUpdate();
        });

        try {
            (typeof el === 'string' ? document.querySelector(el) : el)
                .appendChild(this[GANTT_EL]);
        } catch (err) {
            throw new Error(`Could not initialize gantt board into nonexistent element: ${el}`);
        }
        
        this.updateAttributes();
    }
    
    updateAttributes() {
        this[GANTT_EL].setAttribute('tasks', JSON.stringify(this[BOARD].rows));
        this[GANTT_EL].setAttribute('dependencies', `${this[BOARD].dependencyGraph}`);
        this[GANTT_EL].setAttribute('num-cols', this.numCols);
        this[GANTT_EL].setAttribute('cell-width', this[BOARD].cellWidth);
        this[GANTT_EL].setAttribute('cell-height', this[BOARD].cellHeight);
        this[GANTT_EL].setAttribute('start-date', Number(this[BOARD].minDate));
    }
}