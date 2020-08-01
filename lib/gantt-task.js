import createManagedDateClass from "./managed-date";

const START_DATE = Symbol();
const END_DATE = Symbol();
const VALIDATE_DATES = Symbol();
const DEPENDENCIES = Symbol();
const VALIDATE_DEPENDENCIES = Symbol();
const METADATA = Symbol();
const ID = Symbol();

export default ({EventEmitter}={}) => {
    
    const ManagedDate = createManagedDateClass({EventEmitter});

    return class Task extends EventEmitter {
        constructor({
            id, 
            metadata,
            startDate,
            endDate, 
            dependencies=[]
        }={}) {
            super();

            if (!id) {
                throw new Error('Task id is required.');
            }

            this[ID] = id;
            this[METADATA] = metadata;
            this[DEPENDENCIES] = dependencies;
            this[START_DATE] = new ManagedDate(startDate);
            this[END_DATE] = new ManagedDate(endDate);

            this[VALIDATE_DATES]();
            this[VALIDATE_DEPENDENCIES]();

            [[this[START_DATE], 'start'],[this[END_DATE], 'end']]
                .forEach(([dateManager, dateName]) => {
                    if (dateManager) {
                        dateManager.on('datechange', evt =>
                            this.emit(`${dateName}datechange`, Object.assign({}, evt.detail))
                        );
                        dateManager.on('flooreddatechange', evt => 
                            this.emit(`floored${dateName}datechange`, Object.assign({}, evt.detail))
                        );
                    }
                });

        }

        get metadata() {
            return this[METADATA] || {};
        }

        get id() {
            return this[ID];
        }

        [VALIDATE_DEPENDENCIES]() {
            if (this[DEPENDENCIES].includes(this.id)) {
                throw new Error(`Task "${this.id}" included itself in its dependencies.`);
            }
        }

        addDependency(dep) {
            const deps = [].concat(dep);

            deps.forEach(dep => {
                if (!this[DEPENDENCIES].includes(dep)) {
                    const prevDependencies = this[DEPENDENCIES];
                    this[DEPENDENCIES] = [...prevDependencies, dep];
                    this[VALIDATE_DEPENDENCIES]();
                    this.emit('dependencieschange', { prevDependencies, newDependencies: this[DEPENDENCIES] })
                }
            });
        }

        removeDependency(dep) {
            const deps = [].concat(dep);

            deps.forEach(dep => {
                if (this[DEPENDENCIES].includes(dep)) {
                    const prevDependencies = this[DEPENDENCIES];
                    this[DEPENDENCIES] = prevDependencies.filter(id => id !== dep);
                    this[VALIDATE_DEPENDENCIES]();
                    this.emit('dependencieschange', { prevDependencies, newDependencies: this[DEPENDENCIES] })
                }
            });
        }

        get dependencies() {
            return this[DEPENDENCIES];
        }

        [VALIDATE_DATES]() {
            if (this[START_DATE] && 
                this[START_DATE].date && 
                this[END_DATE] &&
                this[END_DATE].date && 
                (this[START_DATE].date > this[END_DATE].date)
            ) {
                throw new Error(`Task with id "${this.id}" was given start date of ${this[START_DATE].date}, which comes after given end date of ${this[END_DATE].date}.`);
            }
        }

        get startDate() {
            return this[START_DATE].date;
        }

        setStartAndEndDates(startDate, endDate) {
            this[START_DATE].date = startDate;
            this[END_DATE].date = endDate;
            this[VALIDATE_DATES]();
        }

        set startDate(val) {
            this[START_DATE].date = val;
            this[VALIDATE_DATES]();
            return true;
        }

        get endDate() {
            return this[END_DATE].date;
        }

        set endDate(val) {
            this[END_DATE].date = val;
            this[VALIDATE_DATES]();
            return true;
        }

        get flooredStartDate() {
            return this[START_DATE].flooredDate;
        }

        get flooredEndDate() {
            return this[END_DATE].flooredDate;
        }
    }
}