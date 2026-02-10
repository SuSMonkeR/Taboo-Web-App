# Helper function to check if current user can modify target account
def can_modify_account(current_role: str, target_account: Dict) -> bool:
    """
    Check if current user has permission to modify target account.
    
    Permission hierarchy:
    - dev: Can modify everyone
    - owner: Can modify admin and operator (not other owners)
    - admin: Can ONLY modify operator (not other admins or owners)
    - operator: Cannot modify anyone
    
    Returns True if modification is allowed, False otherwise.
    """
    target_role = target_account.get("role")
    
    # Dev can do everything
    if current_role == "dev":
        return True
    
    # Nobody can modify owner accounts (except dev)
    if target_role == "owner":
        return False
    
    # Owner can modify admins and operators
    if current_role == "owner":
        return target_role in ("admin", "operator")
    
    # Admin can ONLY modify operators (peer restriction)
    if current_role == "admin":
        return target_role == "operator"
    
    # Operators can't modify anyone
    return False
