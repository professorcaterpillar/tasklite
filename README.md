# tasklite
A quick task tracking application with no frills and printable day sheets.

Yes, this is 100% vibe-coded from Gemini as I am *not* a webdev by any stretch of the imagination.  Currently have it set up for building via docker and it will create its own data file to act as a database.  **There is no authentication or security of any kind**, so I wouldn't go sticking this out on the open internet.  This was build to live in my cluster to help with my work, so please feel free to mutate/change/fork/add/merge/pull/whatever and I'll look at potentially adding it into this repo.

To build, stick everything in a folder and run `docker compose up -d --build` and hopefully it'll work.  I'll keep adding features and updating as I think of things.
