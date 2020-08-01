const DATE = Symbol();

export default ({EventEmitter}) => class ManagedDate extends EventEmitter {

    constructor(date) {
        super();
        this[DATE] = date ||null;
    }

    get flooredDate() {
        return new Date(
            this.date.getFullYear(),
            this.date.getMonth(),
            this.date.getDate()
        );
    }

    get date() {
        return this[DATE];
    }

    set date(date) {
        const prevDate = this[DATE];
        const prevRoundedDate = this.flooredDate;
        
        this[DATE] = date;

        if (Number(prevDate) != Number(this[DATE])) {
            this.emit('datechange', {prevDate, newDate: this[DATE]});
        }

        if (Number(prevRoundedDate) != Number(this.flooredDate)) {
            this.emit('flooreddatechange', {prevDate: prevRoundedDate, newDate: this.flooredDate});
        }

        return true;
    }
}