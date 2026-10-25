import { useMemo, useState } from "react";
import AdminAuthContext from "./adminAuthContext";

function AdminAuthProvider({ children }) {
  const [csrfToken, setCsrfToken] = useState("");
  const value = useMemo(() => ({ csrfToken, setCsrfToken }), [csrfToken]);

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export default AdminAuthProvider;
