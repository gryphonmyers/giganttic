import EventEmitter from "isomitter";
import createGanttBoardElementClass from "./create-gantt-board-element-class";
import createGanttBoardClass from "./gantt-board";
import createGanttTaskClass from "./gantt-task";

import { html, render } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat';
import { styleMap } from 'lit-html/directives/style-map';
import { classMap } from 'lit-html/directives/class-map';
import { ifDefined } from 'lit-html/directives/if-defined';

const Task = createGanttTaskClass({ EventEmitter });
const Board = createGanttBoardClass({ EventEmitter, Task });

const BOARD = Symbol();
const GANTT_EL = Symbol();

export class BrowserGanttBoard {

    constructor(opts={}) {
        const { el, tasks, taskSort, cellHeight, cellWidth } = opts;

        if (opts.window && !window) window = opts.window;

        const { HTMLElement, document, customElements } = window;

        this[BOARD] = new Board({ tasks, taskSort, cellHeight, cellWidth });

        this[BOARD].on('dependencieschange', evt => this.updateAttributes());
        this[BOARD].on('taskflooredstartdatechange', evt => this.updateAttributes());
        this[BOARD].on('taskflooredenddatechange', evt => this.updateAttributes());
        this[BOARD].on('taskremoved', evt => this.updateAttributes());
        this[BOARD].on('taskadded', evt => this.updateAttributes());

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

        this[GANTT_EL] = document.createElement('gantt-board');
        this[GANTT_EL].addEventListener('taskoffsetchange', ({detail: { taskId, offset, referenceDate }}) => {
            // this[BOARD].getTask(evt.detail.taskId).set()
            console.log('Task offset change', taskId, offset);
            this[BOARD].updateRow({ id: taskId, offset, referenceDate });
        });

        this[GANTT_EL].addEventListener('taskspanchange', ({detail: { taskId, span }}) => {
            console.log('Task span change', taskId, span);
            this[BOARD].updateRow({ id: taskId, span });
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