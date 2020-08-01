import { DependencyGraph } from "./dependency-graph";

const DEPENDENCY_GRAPH = Symbol();
const TASKS = Symbol();
const TASK_SORT = Symbol();
const CELL_HEIGHT = Symbol();
const CELL_WIDTH = Symbol();

const taskHandlers = new Map;

const ONE_DAY_MS = 86400000;
const DEFAULT_CELL_HEIGHT = 20;
const DEFAULT_CELL_WIDTH = 30;

export default ({EventEmitter, Task}) => class Board extends EventEmitter {

    constructor({
        tasks = [],
        taskSort,
        cellHeight=DEFAULT_CELL_HEIGHT, 
        cellWidth=DEFAULT_CELL_WIDTH
    }={}) {
        super();

        this[TASKS] = new Map;
        this[TASK_SORT] = taskSort;
        this[DEPENDENCY_GRAPH] = new DependencyGraph;
        this[CELL_HEIGHT] = cellHeight;
        this[CELL_WIDTH] = cellWidth;

        tasks.forEach(task => this.addTask(task));        
    }

    get cellHeight() {
        return this[CELL_HEIGHT];
    }
    
    get cellWidth() {
        return this[CELL_WIDTH];
    }

    get width() {
        return this.cellWidth * this.numCols;
    }

    get height() {
        return this.cellHeight * this.tasks.length;
    }

    get minDate() {
        return this.minTask.flooredStartDate;
    }

    get maxDate() {
        return this.maxTask.flooredEndDate;
    }

    get numCols() {
        const minDate = this.minDate;
        const maxDate = this.maxDate.getTime() + ONE_DAY_MS;
        const dt = (maxDate - minDate);

        return Math.ceil((dt / ONE_DAY_MS));
    }

    get rows() {
        return this.tasks.map(({id, startDate, endDate, metadata }) => {
            const offset =  Math.floor(((startDate - this.minDate) / ONE_DAY_MS));
            const span = this.getSpanFromTaskDates(startDate, endDate);   
            
            return ({ id, offset, span, metadata }); 
        })
    }

    getSpanFromTaskDates(startDate, endDate) {
        return Math.max(Math.ceil(((endDate - startDate) / ONE_DAY_MS)), 1)
    }

    updateRow({id, offset, span, referenceDate }) {
        const task = this[TASKS].get(id);

        if (!task) {
            throw new Error(`Can't update row because task with "${id}" does not exist.`);
        }

        if (offset != null && span == null) {
            const newStartDate = new Date(Math.max(-Infinity, Number(referenceDate) + (offset * ONE_DAY_MS)));
            const newEndDate = new Date(Math.max(newStartDate, Number(newStartDate) + (this.getSpanFromTaskDates(task.startDate, task.endDate) * ONE_DAY_MS)));

            task.setStartAndEndDates(newStartDate, newEndDate);
        } else if (span != null && offset == null) {
            task.endDate = new Date(Math.max(task.startDate, Number(task.startDate) + (span * ONE_DAY_MS)));
        } else if (offset != null && span != null) {
            const newStartDate = new Date(Math.max(-Infinity, Number(referenceDate) + (offset * ONE_DAY_MS)));
            const newEndDate = new Date(Math.max(newStartDate, Number(newStartDate) + (span * ONE_DAY_MS)));
            
            task.setStartAndEndDates(newStartDate, newEndDate);
        }
    }

    get numRows() {
        return this.tasks.length;
    }

    getTask(id) {
        return this[TASKS].get(id);
    }

    get tasks() {
        const arr = Array.from(this[TASKS].values());

        return this[TASK_SORT]
            ? arr
                .sort(this[TASK_SORT])
            : arr;
    }

    /**
     * 
     * @returns {reason:string,sourceTask:Task,dependencyTask:Task} 
     */

    get invalidPlacements() {
        return this[DEPENDENCY_GRAPH].edges.flatMap(([id, depIds]) => {
            const sourceTask = this[TASKS].get(id);

            return depIds
                .map(depId => this[TASKS].get(depId))
                .filter(dep => !dep || dep.endDate > sourceTask.endDate)
                .map(dependencyTask => ({
                    reason: !dependencyTask 
                        ? 'DEP_NOT_EXIST'
                        : 'DEP_DATE_CONFLICT',
                    sourceTask,
                    dependencyTask
                }))
        })
    }

    get dependencyGraph() {
        return this[DEPENDENCY_GRAPH];
    }

    get minTask() {
        return Array.from(this[TASKS]
            .values())
            .reduce((acc, task) => 
                (!acc || (task.startDate && task.startDate < acc.startDate))
                    ? task
                    : acc
            , null);
    }

    get maxTask() {
        return Array.from(this[TASKS]
            .values())
            .reduce((acc, task) => 
                (!acc || (task.endDate && task.endDate > acc.endDate))
                    ? task
                    : acc
            , null);
    }

    addTask(task) {
        const {id, dependencies=[]} = task;

        if (this[TASKS].has(id)) {
            throw new Error(`Can't add task with id "${id}" because that id is taken.`);
        }

        const newTask = new Task(task);

        const handlers = {
            'dependencieschange': evt => this.emit('taskdependencieschange', Object.assign({task: newTask}, evt.detail)),
            'flooredstartdatechange': evt => this.emit('taskflooredstartdatechange', Object.assign({task: newTask}, evt.detail)),
            'flooredenddatechange': evt => this.emit('taskflooredenddatechange', Object.assign({task: newTask}, evt.detail)),
            'startdatechange': evt => this.emit('taskstartdatechange', Object.assign({task: newTask}, evt.detail)),
            'enddatechange': evt => this.emit('taskenddatechange', Object.assign({task: newTask}, evt.detail))
        };

        taskHandlers.set(newTask, handlers);

        Object.entries(handlers)
            .forEach(([evtName, handler]) => newTask.on(evtName, handler));        

        this[TASKS].set(id, newTask);

        this[DEPENDENCY_GRAPH].addVertex(id);

        dependencies.forEach(dep => this[DEPENDENCY_GRAPH].addEdge(id, dep));

        this.emit('taskadded', { task: newTask });
    }

    removeTask(id) {
        if (this[TASKS].has(id)) {
            this[DEPENDENCY_GRAPH].removeVertex(id);

            const task = this[TASKS].get(id);

            const handlers = taskHandlers.get(task);

            Object.entries(handlers)
                .forEach(([evtName, handler]) => task.off(evtName, handler));
                
            taskHandlers.delete(task);

            this[TASKS].delete(id);

            this.emit('taskremoved', { task });
        }
    }
}