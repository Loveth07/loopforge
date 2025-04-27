;; LoopForge IoT Device Registry
;; A secure, role-based smart contract for managing IoT device registrations
;; Implements device tracking, metadata storage, and strict access controls

;; Error Codes
(define-constant ERR_UNAUTHORIZED u401)
(define-constant ERR_DEVICE_EXISTS u402)
(define-constant ERR_DEVICE_NOT_FOUND u404)
(define-constant ERR_INVALID_STATUS u405)

;; Device Status Enum
(define-constant DEVICE_STATUS_ACTIVE u1)
(define-constant DEVICE_STATUS_INACTIVE u2)
(define-constant DEVICE_STATUS_DEPRECATED u3)

;; Role Definitions
(define-constant ROLE_ADMIN u1)
(define-constant ROLE_DEVICE_MANAGER u2)

;; Maps
;; Device Registry: Maps device ID to device metadata
(define-map devices 
    {device-id: (buff 32)} 
    {
        owner: principal,
        metadata: (string-utf8 256),
        status: uint,
        registered-at: uint
    }
)

;; Role Management: Maps principal to their role
(define-map roles 
    principal 
    uint
)

;; Admin Role Tracking
(define-data-var contract-admin principal tx-sender)

;; Helper Functions
(define-private (is-admin (user principal))
    (is-eq user (var-get contract-admin))
)

(define-private (get-role (user principal))
    (default-to u0 (map-get? roles user))
)

;; Authorization Checks
(define-private (is-authorized-admin)
    (or (is-admin tx-sender) 
        (is-eq (get-role tx-sender) ROLE_ADMIN))
)

(define-private (is-authorized-device-manager)
    (or (is-admin tx-sender)
        (is-eq (get-role tx-sender) ROLE_DEVICE_MANAGER))
)

;; Read-Only Functions
(define-read-only (get-device-info (device-id (buff 32)))
    (map-get? devices {device-id: device-id})
)

(define-read-only (get-device-status (device-id (buff 32)))
    (match (map-get? devices {device-id: device-id})
        device (some (get status device))
        none
    )
)

;; Public Functions
;; Register a new IoT device
(define-public (register-device 
    (device-id (buff 32)) 
    (metadata (string-utf8 256))
)
    (begin
        ;; Check device doesn't already exist
        (asserts! (is-none (map-get? devices {device-id: device-id})) 
            (err ERR_DEVICE_EXISTS))
        
        ;; Only device owners or authorized managers can register
        (asserts! (is-authorized-device-manager) 
            (err ERR_UNAUTHORIZED))
        
        ;; Register device
        (map-set devices 
            {device-id: device-id}
            {
                owner: tx-sender,
                metadata: metadata,
                status: DEVICE_STATUS_ACTIVE,
                registered-at: block-height
            }
        )
        
        (ok true)
    )
)

;; Update device metadata
(define-public (update-device-metadata 
    (device-id (buff 32)) 
    (new-metadata (string-utf8 256))
)
    (let ((current-device (unwrap! 
        (map-get? devices {device-id: device-id}) 
        (err ERR_DEVICE_NOT_FOUND))))
        
        ;; Only device owner or authorized manager can update
        (asserts! 
            (or 
                (is-eq tx-sender (get owner current-device))
                (is-authorized-device-manager)
            ) 
            (err ERR_UNAUTHORIZED)
        )
        
        ;; Update metadata
        (map-set devices 
            {device-id: device-id}
            (merge current-device {metadata: new-metadata})
        )
        
        (ok true)
    )
)

;; Change device status
(define-public (change-device-status 
    (device-id (buff 32)) 
    (new-status uint)
)
    (let ((current-device (unwrap! 
        (map-get? devices {device-id: device-id}) 
        (err ERR_DEVICE_NOT_FOUND))))
        
        ;; Only admins can change status
        (asserts! (is-authorized-admin) (err ERR_UNAUTHORIZED))
        
        ;; Validate status
        (asserts! 
            (or 
                (is-eq new-status DEVICE_STATUS_ACTIVE)
                (is-eq new-status DEVICE_STATUS_INACTIVE)
                (is-eq new-status DEVICE_STATUS_DEPRECATED)
            ) 
            (err ERR_INVALID_STATUS)
        )
        
        ;; Update status
        (map-set devices 
            {device-id: device-id}
            (merge current-device {status: new-status})
        )
        
        (ok true)
    )
)

;; Manage Roles
(define-public (assign-role (user principal) (role uint))
    (begin
        ;; Only admin can assign roles
        (asserts! (is-authorized-admin) (err ERR_UNAUTHORIZED))
        
        ;; Validate role
        (asserts! 
            (or 
                (is-eq role ROLE_ADMIN)
                (is-eq role ROLE_DEVICE_MANAGER)
            ) 
            (err ERR_UNAUTHORIZED)
        )
        
        (map-set roles user role)
        (ok true)
    )
)

;; Initialize Contract
(define-public (init-contract)
    (begin
        ;; Can only be called once
        (asserts! (is-eq tx-sender (var-get contract-admin)) 
            (err ERR_UNAUTHORIZED))
        
        ;; Set initial admin role for contract deployer
        (map-set roles tx-sender ROLE_ADMIN)
        (ok true)
    )
)

;; Transfer Device Ownership
(define-public (transfer-device-ownership 
    (device-id (buff 32)) 
    (new-owner principal)
)
    (let ((current-device (unwrap! 
        (map-get? devices {device-id: device-id}) 
        (err ERR_DEVICE_NOT_FOUND))))
        
        ;; Only current owner or admin can transfer
        (asserts! 
            (or 
                (is-eq tx-sender (get owner current-device))
                (is-authorized-admin)
            ) 
            (err ERR_UNAUTHORIZED)
        )
        
        ;; Update ownership
        (map-set devices 
            {device-id: device-id}
            (merge current-device {owner: new-owner})
        )
        
        (ok true)
    )
)