# Core data write consistency

QTableUI treats field and record mutations as acknowledged writes, not fire-and-forget UI events.

For field create/update/delete, record update/delete, and field reorder:

1. the UI may apply an optimistic local change;
2. the store awaits the GraphQL mutation result;
3. the mutation response becomes canonical when it is available;
4. if the request fails or is ambiguous, the client re-reads the affected server state before deciding whether to roll back;
5. a server state that already contains the requested change is treated as success (for example, a response timeout after the server committed);
6. otherwise the client restores canonical server state or the pre-write snapshot and surfaces an error;
7. user-visible success feedback must only be emitted after acknowledgement.

The release contract is `npm run test:data-write-closure` and is also executed by Frontend CI.
