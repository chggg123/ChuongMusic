const imageAvatarPattern = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const ProfileAvatar = ({ avatar, fallback = '👤', className = '' }) => {
  const isImage = typeof avatar === 'string' && imageAvatarPattern.test(avatar);

  return (
    <span className={className}>
      {isImage ? <img src={avatar} alt="" /> : avatar || fallback}
    </span>
  );
};
