import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { GET_USERS } from "../lib/userQueries";

const CREATE_USER = gql`
  mutation CreateUser($username: String!, $email: String!) {
    createUser(username: $username, email: $email) {
      id
      username
      email
    }
  }
`;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "8px 16px",
        backgroundColor: pending ? "#ccc" : "#007bff",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: pending ? "not-allowed" : "pointer",
      }}
    >
      {pending ? "Creating..." : "Add User"}
    </button>
  );
}

export function UserForm() {
  const [createUser] = useMutation(CREATE_USER, {
    // Refetch users after creation to update the list
    refetchQueries: [{ query: GET_USERS }],
  });

  const [state, formAction] = useActionState<
    { message: string | null; error: string | null },
    FormData
  >(
    async (
      _prevState: { message: string | null; error: string | null },
      formData: FormData,
    ) => {
      const username = formData.get("username") as string;
      const email = formData.get("email") as string;

      if (!username || !email) {
        return { message: null, error: "Username and email are required" };
      }

      try {
        await createUser({ variables: { username, email } });
        return { message: "User created successfully!", error: null };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return { message: null, error: message };
      }
    },
    { message: null, error: null },
  );

  return (
    <form
      action={formAction}
      style={{
        marginBottom: "20px",
        padding: "20px",
        border: "1px solid #eee",
        borderRadius: "8px",
      }}
    >
      <h3>Add New User (React 19 Actions Demo)</h3>
      <div style={{ marginBottom: "10px" }}>
        <input
          name="username"
          placeholder="Username"
          style={{ marginRight: "10px", padding: "8px" }}
        />
        <input
          name="email"
          placeholder="Email"
          type="email"
          style={{ marginRight: "10px", padding: "8px" }}
        />
        <SubmitButton />
      </div>
      {state.error && <p style={{ color: "red" }}>{state.error}</p>}
      {state.message && <p style={{ color: "green" }}>{state.message}</p>}
    </form>
  );
}
