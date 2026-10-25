import { useContext } from "react";
import AdminAuthContext from "./adminAuthContext";

function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  }
  return context;
}

export default useAdminAuth;
