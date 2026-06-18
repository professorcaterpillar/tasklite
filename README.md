# tasklite
A quick task tracking application with no frills and printable day sheets.  
Simple interface, supports mobile (ish), along with the main requirements I had:
- Recurring tasks
- Totalling the time estimate for each day
- Easily move due dates to other days
- Quick entry via keyboard shortcuts:
    - `N` opens new task creation
    - `Ctrl+enter` saves the currently open task
    - `tab` will get you through the new task UI pretty quickly

## Some things that are chosen simply for my workflow:
- Hitting the print button defaults to tomorrow as I usually build the task list the night before.
- The "Move Forward" button moves all non-completed tasks from the current day to tomorrow
- New tasks default to being due tomorrow
- "Info" level tasks do not count to the day's time total
- The print sheet is made for black and white printers

## Things to work on:
- Need arrows to navigate forward/backward in the main view without having to hit "Jump"
- Need an "all tasks" view that shows all tasks currently entered into the system, sorted by due date (and only showing the next instance of a recurring task)
- Need the ability to filter out "Info" level tasks onto another page when printing (as an option)
- Color for the print sheet might be nice, but I don't have a color printer, so I don't really care

Yes, this is 100% vibe-coded from Gemini as I am *not* a webdev by any stretch of the imagination.  Currently have it set up for building via docker and it will create its own data file to act as a database.  ***There is no authentication or security of any kind***, so I wouldn't go sticking this out on the open internet.  This was built to live in my cluster to help with my work, so please feel free to mutate/change/fork/add/merge/pull/whatever and I'll look at potentially adding it into this repo.

To build, stick everything in a folder and run `docker compose up -d --build` and hopefully it'll work.  I'll keep adding features and updating as I think of things.
