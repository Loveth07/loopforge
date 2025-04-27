;; LoopForge: IoT Application Template Registry
;; A decentralized platform for managing IoT application templates

;; Error Codes
(define-constant ERR_UNAUTHORIZED (err u403))
(define-constant ERR_TEMPLATE_NOT_FOUND (err u404))
(define-constant ERR_TEMPLATE_ALREADY_EXISTS (err u409))
(define-constant ERR_INVALID_VERSION (err u400))
(define-constant ERR_TEMPLATE_DEPRECATED (err u410))

;; Roles
(define-constant ROLE_ADMIN tx-sender)
(define-constant ROLE_TEMPLATE_SUBMITTER tx-sender)

;; Template Metadata Structure
(define-map templates 
  {template-id: (string-ascii 50)} 
  {
    creator: principal,
    name: (string-ascii 100),
    description: (string-ascii 500),
    version: (string-ascii 20),
    is-deprecated: bool,
    created-at: uint,
    metadata-uri: (string-ascii 256)
  }
)

;; Version Tracking Map
(define-map template-versions
  {template-id: (string-ascii 50), version: (string-ascii 20)}
  {
    changelog: (string-ascii 500),
    approved-by: principal,
    approved-at: uint
  }
)

;; Helper function to validate template submission
(define-private (is-valid-template-id (template-id (string-ascii 50)))
  (and 
    (> (len template-id) u3)
    (< (len template-id) u50)
  )
)

;; Function to submit a new IoT application template
(define-public (submit-template 
  (template-id (string-ascii 50))
  (name (string-ascii 100))
  (description (string-ascii 500))
  (version (string-ascii 20))
  (metadata-uri (string-ascii 256))
)
  (begin
    ;; Validate template ID
    (asserts! (is-valid-template-id template-id) ERR_INVALID_VERSION)
    
    ;; Check if template already exists
    (asserts! (is-none (map-get? templates {template-id: template-id})) 
              ERR_TEMPLATE_ALREADY_EXISTS)
    
    ;; Authorize only allowed template submitters
    (asserts! (is-eq tx-sender ROLE_TEMPLATE_SUBMITTER) ERR_UNAUTHORIZED)
    
    ;; Store template metadata
    (map-set templates 
      {template-id: template-id}
      {
        creator: tx-sender,
        name: name,
        description: description,
        version: version,
        is-deprecated: false,
        created-at: block-height,
        metadata-uri: metadata-uri
      }
    )
    
    ;; Store initial version details
    (map-set template-versions
      {template-id: template-id, version: version}
      {
        changelog: "Initial version",
        approved-by: tx-sender,
        approved-at: block-height
      }
    )
    
    (ok true)
  )
)

;; Function to update template metadata
(define-public (update-template
  (template-id (string-ascii 50))
  (name (string-ascii 100))
  (description (string-ascii 500))
  (metadata-uri (string-ascii 256))
)
  (let 
    ((existing-template (unwrap! 
      (map-get? templates {template-id: template-id}) 
      ERR_TEMPLATE_NOT_FOUND))
    )
    ;; Authorization check
    (asserts! 
      (or 
        (is-eq tx-sender (get creator existing-template))
        (is-eq tx-sender ROLE_ADMIN)
      ) 
      ERR_UNAUTHORIZED
    )
    
    ;; Update template metadata
    (map-set templates 
      {template-id: template-id}
      (merge existing-template {
        name: name,
        description: description,
        metadata-uri: metadata-uri
      })
    )
    
    (ok true)
  )
)

;; Function to deprecate a template
(define-public (deprecate-template (template-id (string-ascii 50)))
  (let 
    ((existing-template (unwrap! 
      (map-get? templates {template-id: template-id}) 
      ERR_TEMPLATE_NOT_FOUND))
    )
    ;; Authorization check
    (asserts! 
      (or 
        (is-eq tx-sender (get creator existing-template))
        (is-eq tx-sender ROLE_ADMIN)
      ) 
      ERR_UNAUTHORIZED
    )
    
    ;; Mark template as deprecated
    (map-set templates 
      {template-id: template-id}
      (merge existing-template {is-deprecated: true})
    )
    
    (ok true)
  )
)

;; Read-only function to get template details
(define-read-only (get-template-details (template-id (string-ascii 50)))
  (map-get? templates {template-id: template-id})
)

;; Read-only function to get template version details
(define-read-only (get-template-version 
  (template-id (string-ascii 50))
  (version (string-ascii 20))
)
  (map-get? template-versions 
    {template-id: template-id, version: version}
  )
)