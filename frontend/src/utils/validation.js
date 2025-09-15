import { useState, useCallback } from 'react';

// Validation rules
export const VALIDATION_RULES = {
  required: (value) => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  username: (value) => {
    if (!value) return null;
    if (value.length < 3) {
      return 'Username must be at least 3 characters long';
    }
    if (value.length > 20) {
      return 'Username must be less than 20 characters long';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
  },

  password: (value) => {
    if (!value) return null;
    if (value.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (value.length > 100) {
      return 'Password must be less than 100 characters long';
    }
    return null;
  },

  confirmPassword: (value, originalPassword) => {
    if (!value) return null;
    if (value !== originalPassword) {
      return 'Passwords do not match';
    }
    return null;
  },

  message: (value) => {
    if (!value) return null;
    if (value.trim().length === 0) {
      return 'Message cannot be empty';
    }
    if (value.length > 1000) {
      return 'Message must be less than 1000 characters';
    }
    return null;
  },

  minLength: (min) => (value) => {
    if (!value) return null;
    if (value.length < min) {
      return `Must be at least ${min} characters long`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (!value) return null;
    if (value.length > max) {
      return `Must be less than ${max} characters long`;
    }
    return null;
  }
};

// Validate a single field
export const validateField = (value, rules) => {
  if (!rules || rules.length === 0) return null;

  for (const rule of rules) {
    const error = typeof rule === 'function' ? rule(value) : rule;
    if (error) return error;
  }
  return null;
};

// Validate multiple fields
export const validateForm = (formData, validationSchema) => {
  const errors = {};
  let isValid = true;

  Object.keys(validationSchema).forEach(fieldName => {
    const fieldValue = formData[fieldName];
    const fieldRules = validationSchema[fieldName];
    const error = validateField(fieldValue, fieldRules);
    
    if (error) {
      errors[fieldName] = error;
      isValid = false;
    }
  });

  return { isValid, errors };
};

// Common validation schemas
export const VALIDATION_SCHEMAS = {
  login: {
    username: [VALIDATION_RULES.required, VALIDATION_RULES.username],
    password: [VALIDATION_RULES.required]
  },

  register: {
    username: [VALIDATION_RULES.required, VALIDATION_RULES.username],
    email: [VALIDATION_RULES.required, VALIDATION_RULES.email],
    password: [VALIDATION_RULES.required, VALIDATION_RULES.password]
  },

  addContact: {
    username: [VALIDATION_RULES.required, VALIDATION_RULES.username]
  },

  message: {
    content: [VALIDATION_RULES.required, VALIDATION_RULES.message]
  }
};

// Real-time validation hook
export const useFormValidation = (initialValues, validationSchema) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = useCallback((fieldName, value) => {
    const fieldRules = validationSchema[fieldName];
    if (!fieldRules) return null;

    return validateField(value, fieldRules);
  }, [validationSchema]);

  const handleChange = useCallback((fieldName, value) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    
    // Validate field if it has been touched
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({ ...prev, [fieldName]: error }));
    }
  }, [validateField, touched]);

  const handleBlur = useCallback((fieldName) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    
    const error = validateField(fieldName, values[fieldName]);
    setErrors(prev => ({ ...prev, [fieldName]: error }));
  }, [validateField, values]);

  const validateAll = useCallback(() => {
    const { isValid, errors: validationErrors } = validateForm(values, validationSchema);
    setErrors(validationErrors);
    setTouched(Object.keys(validationSchema).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {}));
    return isValid;
  }, [values, validationSchema]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0
  };
};

// Sanitize user input
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
};

// Validate file uploads
export const validateFile = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
    required = false
  } = options;

  if (!file) {
    return required ? 'File is required' : null;
  }

  if (file.size > maxSize) {
    return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`;
  }

  if (!allowedTypes.includes(file.type)) {
    return `File type must be one of: ${allowedTypes.join(', ')}`;
  }

  return null;
};