import React, { useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Camera, MapPin, Building, Shield, User } from 'lucide-react';

export const UserProfileCard = () => {
    const { user } = useAuth();
    const { employees, areas, addresses, updateEmployee } = useData();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get current user data from DataContext (which includes localStorage persistence)
    const displayUser = employees.find(e => e.id === user?.id);

    if (!displayUser) return null;

    // Find linked data
    const userArea = areas.find(a => a.areaCode === displayUser.areaCode);
    const userOffice = addresses.find(a => a.addressCode === displayUser.addressCode);

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Convert to Base64
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            // Update employee with new image
            try {
                const updatedUser = { ...displayUser, profileImage: base64String };
                await updateEmployee(updatedUser);
                // setDisplayUser(updatedUser); // No longer needed, context update drives UI
            } catch (error) {
                console.error('Failed to update profile image', error);
                alert('画像の保存に失敗しました。');
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="flex flex-col items-center bg-background-paper p-6 rounded-2xl shadow-card border border-border w-full max-w-sm relative group">
            {/* Title */}
            <h3 className="text-xl font-bold text-text-main mb-6">{displayUser.name}</h3>

            {/* Center Visual: Profile Image mimicking Donut Chart */}
            <div className="relative mb-6">
                <div
                    onClick={handleImageClick}
                    className="w-40 h-40 rounded-full border-[12px] border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer group/image relative transition-colors hover:border-slate-200"
                >
                    <div className="w-full h-full rounded-full overflow-hidden relative bg-gray-50">
                        {displayUser.profileImage ? (
                            <img src={displayUser.profileImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <User size={64} />
                            </div>
                        )}

                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/image:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera className="text-white drop-shadow-md" size={32} />
                        </div>
                    </div>
                </div>

                {/* Optional Status Badge similar to chart accent */}
                <div className="absolute bottom-2 right-2 bg-emerald-400 border-4 border-white rounded-full p-2 shadow-sm"></div>
            </div>

            {/* Stats / Info List */}
            <div className="w-full space-y-3 mt-2">
                <div className="flex justify-between items-center text-sm text-text-secondary border-b border-slate-100 pb-2">
                    <span className="flex items-center gap-2 font-medium">
                        <Shield size={16} className="text-slate-400" />
                        権限
                    </span>
                    <span className="font-bold text-text-main">
                        {displayUser.role === 'admin' ? '管理者' : '一般ユーザー'}
                    </span>
                </div>

                <div className="flex justify-between items-center text-sm text-text-secondary border-b border-slate-100 pb-2">
                    <span className="flex items-center gap-2 font-medium">
                        <MapPin size={16} className="text-slate-400" />
                        エリア
                    </span>
                    <span className="font-bold text-text-main text-right truncate max-w-[150px]">
                        {userArea?.areaName || '未設定'}
                    </span>
                </div>

                <div className="flex justify-between items-center text-sm text-text-secondary pb-1">
                    <span className="flex items-center gap-2 font-medium">
                        <Building size={16} className="text-slate-400" />
                        事業所
                    </span>
                    <span className="font-bold text-text-main text-right truncate max-w-[150px]">
                        {userOffice?.officeName || '未設定'}
                    </span>
                </div>
            </div>

            {/* Hidden Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*.png, image/*.jpeg, image/*.jpg"
                className="hidden"
            />
        </div>
    );
};
