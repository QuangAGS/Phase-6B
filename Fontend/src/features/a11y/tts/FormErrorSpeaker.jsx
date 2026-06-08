import React from 'react';
import { useTts } from './useTts';

const FormErrorSpeaker = ({ errors }) => {
  const { speak } = useTts();

  React.useEffect(() => {
    if (errors && Object.keys(errors).length > 0) {
      const errorText = Object.values(errors).join('. ');
      speak(`Có lỗi xảy ra: ${errorText}`);
    }
  }, [errors, speak]);

  return null;
};

export default FormErrorSpeaker;