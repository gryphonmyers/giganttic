const test = require('ava');

import EventEmitter from "isomitter";

import createGanttBoardClass from "../lib/gantt-board";
import createGanttTaskClass from "../lib/gantt-task";

test('Pass', t => t.pass());
const Task = createGanttTaskClass({EventEmitter});
const Board = createGanttBoardClass({EventEmitter, Task});

test('Gantt tasks have expected format', t => {    
    const startDate = new Date(Date.now());
    const endDate = new Date(Date.now() + 86400000);

    const gantt = new Board({
        tasks: [
            {
                id: '1',
                startDate,
                endDate
            },
            {
                id: '2',
                startDate,
                endDate,
                dependencies: [
                    '1'
                ]
            }
        ]
    });

    t.deepEqual(gantt.tasks[0].dependencies, []);
    t.deepEqual(gantt.tasks[1].dependencies, ['1']);
    t.is(gantt.tasks[0].id, '1');
    t.is(gantt.tasks[1].id, '2');
});

test('Tasks with date conflicts are listed as invalid placements', t => {

    const gantt = new Board({
        tasks: [
            {
                id: '1',
                startDate: new Date(Date.now()),
                endDate: new Date(Date.now() + (86400000 * 2)) //dependent task ends after depending task
            },
            {
                id: '2',
                startDate: new Date(Date.now()),
                endDate: new Date(Date.now() + 86400000),
                dependencies: [
                    '1'
                ]
            }
        ]
    });

    t.is(gantt.invalidPlacements[0].dependencyTask.id, '1');
    t.is(gantt.invalidPlacements[0].sourceTask.id, '2');
    t.is(gantt.invalidPlacements[0].reason, 'DEP_DATE_CONFLICT');
});

test('Task rounded dates have expected value', t => {
    const task = new Task({
        id: '1',
        startDate: new Date(2020, 4, 1, 8, 34),
        endDate: new Date(2020, 6, 3, 0, 10)
    });

    t.is(task.flooredEndDate.getFullYear(), 2020);
    t.is(task.flooredEndDate.getMonth(), 6);
    t.is(task.flooredEndDate.getDate(), 3);
    t.is(task.flooredEndDate.getHours(), 0);
    t.is(task.flooredEndDate.getMinutes(), 0);

    t.is(task.flooredStartDate.getFullYear(), 2020);
    t.is(task.flooredStartDate.getMonth(), 4);
    t.is(task.flooredStartDate.getDate(), 1);
    t.is(task.flooredStartDate.getHours(), 0);
    t.is(task.flooredStartDate.getMinutes(), 0);
});

test('Creating task with impossible date range throws error', t => {
    const err = t.throws(() => new Task({
        id: '1', 
        startDate: new Date(2020, 4, 2, 8, 34), 
        endDate: new Date(2020, 4, 1, 8, 34) }))
    t.is(err.message, 'Task with id "1" was given start date of Sat May 02 2020 08:34:00 GMT-0700 (Pacific Daylight Time), which comes after given end date of Fri May 01 2020 08:34:00 GMT-0700 (Pacific Daylight Time).');
});

test('Creating task with identical start and end dates does not throw error', t => {
    t.notThrows(() => new Task({
        id: '1', 
        startDate: new Date(2020, 4, 2, 8, 34), 
        endDate: new Date(2020, 4, 2, 8, 34) 
    }));
    // t.is(err.message, 'Task with id "1" was given start date of Sat May 02 2020 08:34:00 GMT-0700 (Pacific Daylight Time), which comes after given end date of Fri May 01 2020 08:34:00 GMT-0700 (Pacific Daylight Time).');
});

test('Creating board with tasks with dupe ids throws error', t => {

    const err = t.throws(() => {
        const gantt = new Board({
            tasks: [
                {
                    id: '1',
                    startDate: new Date(Date.now()),
                    endDate: new Date(Date.now() + (86400000 * 2)) //dependent task ends after depending task
                },
                {
                    id: '1',
                    startDate: new Date(Date.now()),
                    endDate: new Date(Date.now() + 86400000),
                    dependencies: [
                        '2'
                    ]
                }
            ]
        });
    });

    t.is(err.message, 'Can\'t add task with id "1" because that id is taken.');
});


test('Board task sort works', t => {

  const gantt = new Board({
      taskSort: (a,b) => a.endDate > b.endDate ? 1 : -1,
      tasks: [
          {
            id: '3',
            startDate: new Date(Date.now()),
            endDate: new Date(Date.now() + (86400000 * 3)),
            dependencies: [
                '2'
            ]
          },
          {
            id: '1',
            startDate: new Date(Date.now()),
            endDate: new Date(Date.now() + 86400000),
            dependencies: [
                '2'
            ]
        },
          {
              id: '2',
              startDate: new Date(Date.now()),
              endDate: new Date(Date.now() + (86400000 * 2)) //dependent task ends after depending task
          },
          
      ]
  });

  t.deepEqual(gantt.tasks.map(({id}) => id), ['1', '2', '3']);
});


test('Creating task with dependency on itself throws error', t => {
    const err = t.throws(() => {
        const task = new Task({
            id: '1',
            startDate: new Date(Date.now()),
            endDate: new Date(Date.now() + 86400000),
            dependencies: [
                '1'
            ]
        });
    });

    t.is(err.message, 'Task "1" included itself in its dependencies.');
});

test('Setting task dates fires expected date events', t => {
    const events = [];

    const now = 1595207347618;

    const task = new Task({
        id: '1',
        startDate: new Date(now),
        endDate: new Date(now + 86400000),
    });

    task.on('startdatechange', evt => events.push(evt));
    task.on('enddatechange', evt => events.push(evt));
    task.on('flooredstartdatechange', evt => events.push(evt));
    task.on('flooredenddatechange', evt => events.push(evt));

    task.startDate = new Date(now + 200);
    task.startDate = new Date(now + 86400000);
    task.endDate = new Date(now + (86400000 + 100));
    task.endDate = new Date(now + (86400000 * 2));

    t.deepEqual(JSON.parse(JSON.stringify(events)), [
        {
          detail: {
            newDate: '2020-07-20T01:09:07.818Z',
            prevDate: '2020-07-20T01:09:07.618Z',
          },
          eventName: 'startdatechange',
          newDate: '2020-07-20T01:09:07.818Z',
          prevDate: '2020-07-20T01:09:07.618Z',
          type: 'startdatechange',
        },
        {
          detail: {
            newDate: '2020-07-21T01:09:07.618Z',
            prevDate: '2020-07-20T01:09:07.818Z',
          },
          eventName: 'startdatechange',
          newDate: '2020-07-21T01:09:07.618Z',
          prevDate: '2020-07-20T01:09:07.818Z',
          type: 'startdatechange',
        },
        {
          detail: {
            newDate: '2020-07-20T07:00:00.000Z',
            prevDate: '2020-07-19T07:00:00.000Z',
          },
          eventName: 'flooredstartdatechange',
          newDate: '2020-07-20T07:00:00.000Z',
          prevDate: '2020-07-19T07:00:00.000Z',
          type: 'flooredstartdatechange',
        },
        {
          detail: {
            newDate: '2020-07-21T01:09:07.718Z',
            prevDate: '2020-07-21T01:09:07.618Z',
          },
          eventName: 'enddatechange',
          newDate: '2020-07-21T01:09:07.718Z',
          prevDate: '2020-07-21T01:09:07.618Z',
          type: 'enddatechange',
        },
        {
          detail: {
            newDate: '2020-07-22T01:09:07.618Z',
            prevDate: '2020-07-21T01:09:07.718Z',
          },
          eventName: 'enddatechange',
          newDate: '2020-07-22T01:09:07.618Z',
          prevDate: '2020-07-21T01:09:07.718Z',
          type: 'enddatechange',
        },
        {
          detail: {
            newDate: '2020-07-21T07:00:00.000Z',
            prevDate: '2020-07-20T07:00:00.000Z',
          },
          eventName: 'flooredenddatechange',
          newDate: '2020-07-21T07:00:00.000Z',
          prevDate: '2020-07-20T07:00:00.000Z',
          type: 'flooredenddatechange',
        }
    ]);
});


test('Adding invalid dep after initialization throws error', t => {
    
    const now = 1595207347618;

    const task = new Task({
        id: '1',
        startDate: new Date(now),
        endDate: new Date(now + 86400000),
        dependencies: ['2']
    });

    const err = t.throws(() => task.addDependency('1'))

    t.is(err.message, 'Task "1" included itself in its dependencies.');
});

test('Adding and removing task deps has expected results and triggers change events', t => {
    const events = [];

    const now = 1595207347618;

    const task = new Task({
        id: '1',
        startDate: new Date(now),
        endDate: new Date(now + 86400000),
        dependencies: ['2']
    });

    task.on('dependencieschange', evt => events.push(evt));

    task.addDependency('3');
    task.addDependency(['3', '4']);
    task.removeDependency('5');
    task.removeDependency('3');

    t.deepEqual(task.dependencies, ['2', '4']);

    t.deepEqual(JSON.parse(JSON.stringify(events)), [
        {
          detail: {
            newDependencies: [
              '2',
              '3',
            ],
            prevDependencies: [
              '2',
            ],
          },
          eventName: 'dependencieschange',
          newDependencies: [
            '2',
            '3',
          ],
          prevDependencies: [
            '2',
          ],
          type: 'dependencieschange',
        },
        {
          detail: {
            newDependencies: [
              '2',
              '3',
              '4',
            ],
            prevDependencies: [
              '2',
              '3',
            ],
          },
          eventName: 'dependencieschange',
          newDependencies: [
            '2',
            '3',
            '4',
          ],
          prevDependencies: [
            '2',
            '3',
          ],
          type: 'dependencieschange',
        },
        {
          detail: {
            newDependencies: [
              '2',
              '4',
            ],
            prevDependencies: [
              '2',
              '3',
              '4',
            ],
          },
          eventName: 'dependencieschange',
          newDependencies: [
            '2',
            '4',
          ],
          prevDependencies: [
            '2',
            '3',
            '4',
          ],
          type: 'dependencieschange',
        }
    ]);
});



test('Board dimensions have expected values', t => {

  const gantt = new Board({
      taskSort: (a,b) => a.endDate > b.endDate ? 1 : -1,
      cellHeight: 25,
      cellWidth: 25,
      tasks: [
          {
            id: '3',
            startDate: new Date(Date.now()),
            endDate: new Date(Date.now() + (86400000 * 3)),
            dependencies: [
                '2'
            ]
          },
          {
            id: '1',
            startDate: new Date(Date.now()),
            endDate: new Date(Date.now() + 86400000),
            dependencies: [
                '2'
            ]
        },
          {
              id: '2',
              startDate: new Date(Date.now()),
              endDate: new Date(Date.now() + (86400000 * 2)) //dependent task ends after depending task
          },
          
      ]
  });

  t.is(gantt.numCols, 4);
  t.is(gantt.numRows, 3);
  t.is(gantt.width, 100);
  t.is(gantt.height, 75)
});

test('Board has expected min and max date', t => {
  const now = Date.now();
  const gantt = new Board({
      taskSort: (a,b) => a.endDate > b.endDate ? 1 : -1,
      tasks: [
          {
            id: '3',
            startDate: new Date(now),
            endDate: new Date(now + (86400000 * 3)),
            dependencies: [
                '2'
            ]
          },
          {
            id: '1',
            startDate: new Date(now),
            endDate: new Date(now + 86400000),
            dependencies: [
                '2'
            ]
        },
          {
              id: '2',
              startDate: new Date(now),
              endDate: new Date(now + (86400000 * 2)) //dependent task ends after depending task
          },
          
      ]
  });

  const minDate = new Date(now);
  const maxDate = new Date(now + (86400000 * 3));

  t.is(Number(gantt.minDate), Number(new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())));
  t.is(Number(gantt.maxDate), Number(new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())));
});


test('Board has expected min and max tasks', t => {
  const now = Date.now();
  const gantt = new Board({
      taskSort: (a,b) => a.endDate > b.endDate ? 1 : -1,
      tasks: [
          {
            id: '3',
            startDate: new Date(now),
            endDate: new Date(now + (86400000 * 3)),
            dependencies: [
                '2'
            ]
          },
          {
            id: '1',
            startDate: new Date(now),
            endDate: new Date(now + 86400000),
            dependencies: [
                '2'
            ]
        },
          {
              id: '2',
              startDate: new Date(now - 1),
              endDate: new Date(now + (86400000 * 2)) //dependent task ends after depending task
          },
          
      ]
  });

  t.is(gantt.minTask.id, '2');
  t.is(gantt.maxTask.id, '3');
});

test('Board rows have expected values', t => {

  const gantt = new Board({
      taskSort: (a,b) => a.endDate > b.endDate ? 1 : -1,
      tasks: [
          {
            id: '3',
            startDate: new Date(Date.now() + (86400000 * 3)),
            endDate: new Date(Date.now() + (86400000 * 6)),
            dependencies: [
                '2'
            ]
          },
          {
            id: '1',
            startDate: new Date(Date.now()),
            endDate: new Date(Date.now() + 86400000),
            dependencies: [
                '2'
            ]
        },
        {
          id: '4',
          startDate: new Date(Date.now()),
          endDate: new Date(Date.now()),
          dependencies: [
              '2'
          ]
      },
          {
              id: '2',
              startDate: new Date(Date.now()),
              endDate: new Date(Date.now() + (86400000 * 2)) //dependent task ends after depending task
          },
          
      ]
  });

  t.deepEqual(gantt.rows, [
    {
      id: '4',
      metadata: {},
      offset: 0,
      span: 1,
    },
    {
      id: '1',
      metadata: {},
      offset: 0,
      span: 1,
    },
    {
      id: '2',
      metadata: {},
      offset: 0,
      span: 2,
    },
    {
      id: '3',
      metadata: {},
      offset: 3,
      span: 3,
    },
  ]);
});


test.todo('Setting task date to invalid state after initialization throws error')
test.todo('Ensure time zone differences do not adversely affect');
test.todo('Changing task dates emits all expected events');
test.todo('Passing null start or end dates defaults to current date, or dependency context');
test.todo('Initiating board with conflicting task IDs throws error');
test.todo('Node graph points to dependencies correctly');
test.todo('Changing date triggers date change event');
test.todo('Changing dependencies triggers dependency change event');
test.todo('Test updaterow');
// export default ({Board}) => {  

    
       
// }