const DATE = Symbol();
const FLOORED_DATE = Symbol();

export default ({EventEmitter}) => class ManagedDate extends EventEmitter {

    constructor(date) {
        super();
        this.date = date;
    }

    get flooredDate() {
        return this[FLOORED_DATE];
    }

    get date() {
        return this[DATE];
    }

    set date(date) {
        const prevDate = this[DATE];
        const prevRoundedDate = this.flooredDate;
        
        this[DATE] = date || null;
        this[FLOORED_DATE] = date ? new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        ) : null;

        if (Number(prevDate) != Number(this[DATE])) {
            this.emit('datechange', {prevDate, newDate: this[DATE]});
        }

        if (Number(prevRoundedDate) != Number(this.flooredDate)) {
            this.emit('flooreddatechange', {prevDate: prevRoundedDate, newDate: this.flooredDate});
        }

        return true;
    }
}